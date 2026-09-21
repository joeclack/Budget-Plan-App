import { useCallback, useEffect, useRef, useState } from "react";
import { useBudgetRepository } from "../../db/context";
import {
  copyBudget,
  createBlankMonth,
  createTemplate,
  instantiateTemplate,
  renameTemplate,
  replaceTemplateStructure,
} from "../../domain/budget";
import type { BudgetTemplate } from "../../domain/budget";
import type { BudgetDocument } from "../../domain/budget/types";
import { initialiseBudget, type BudgetState } from "./initialise";
import { subscribeBudgetChanges } from "./changes";
import type { PayEstimateSnapshot } from "../../domain/pay";

export function useBudget() {
  const repository = useBudgetRepository();
  const [state, setState] = useState<BudgetState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const initialise = useCallback(
    () => initialiseBudget(repository),
    [repository],
  );

  useEffect(() => {
    let active = true;
    initialise()
      .then((next) => {
        if (active) setState(next);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to open your budgets.",
          );
      });
    return () => {
      active = false;
    };
  }, [initialise]);

  useEffect(
    () =>
      subscribeBudgetChanges(() => {
        initialise()
          .then(setState)
          .catch((reason: unknown) =>
            setError(
              reason instanceof Error
                ? reason.message
                : "Unable to refresh budgets.",
            ),
          );
      }),
    [initialise],
  );

  async function run(action: () => Promise<BudgetState>): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      setState(await action());
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The change could not be saved. Please retry.",
      );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function committed(
    document: BudgetDocument,
    snapshot?: PayEstimateSnapshot,
  ): Promise<BudgetState> {
    const saved = await repository.saveMonth(document, snapshot);
    const next = savedState(saved);
    // The month is already committed. Keep its new revision even if selection fails.
    setState(next);
    try {
      await repository.setSelectedMonthId(saved.month.id);
    } catch {
      setError("Budget saved. Your last-opened month could not be remembered.");
    }
    return next;
  }

  function savedState(saved: BudgetDocument): BudgetState {
    return {
      document: saved,
      months: [
        ...(state?.months ?? []).filter((month) => month.id !== saved.month.id),
        saved.month,
      ].sort((a, b) => b.year - a.year || b.month - a.month),
      templates: state?.templates ?? [],
      period: { year: saved.month.year, month: saved.month.month },
    };
  }

  return {
    state,
    busy,
    error,
    clearError: () => setError(null),
    retry: () => run(initialise),
    selectPeriod: (year: number, month: number) =>
      run(async () => {
        if (!state) return initialise();
        const document = await repository.findMonth(year, month);
        if (document) await repository.setSelectedMonthId(document.month.id);
        return { ...state, document, period: { year, month } };
      }),
    createMonth: (sourceId?: string, templateId?: string) =>
      run(async () => {
        if (!state) throw new Error("Choose a month first.");
        const { year, month } = state.period;
        if (sourceId) {
          const source = await repository.loadMonth(sourceId);
          if (!source) throw new Error("The source month could not be found.");
          return committed(copyBudget(source, year, month));
        }
        if (templateId) {
          const template = await repository.loadTemplate(templateId);
          if (!template) throw new Error("The template could not be found.");
          return committed(instantiateTemplate(template, year, month));
        }
        return committed(createBlankMonth(year, month));
      }),
    saveDraft: (draft: BudgetDocument, snapshot?: PayEstimateSnapshot) =>
      run(() => committed(draft, snapshot)),
    setLocked: (locked: boolean) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a budget first.");
        const month = state.document.month;
        return savedState(
          await repository.setMonthLocked(month.id, month.revision, locked),
        );
      }),
    saveTemplate: (name: string) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a budget first.");
        const saved = await repository.saveTemplate(
          createTemplate(state.document, name),
        );
        return {
          ...state,
          templates: [...state.templates, saved].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        };
      }),
    renameTemplate: (template: BudgetTemplate, name: string) =>
      run(async () => {
        if (!state) throw new Error("Open the template manager again.");
        const saved = await repository.saveTemplate(
          renameTemplate(template, name),
        );
        return {
          ...state,
          templates: [
            ...state.templates.filter((item) => item.id !== saved.id),
            saved,
          ].sort((a, b) => a.name.localeCompare(b.name)),
        };
      }),
    replaceTemplate: (template: BudgetTemplate) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a saved month first.");
        const saved = await repository.saveTemplate(
          replaceTemplateStructure(template, state.document),
        );
        return {
          ...state,
          templates: state.templates.map((item) =>
            item.id === saved.id ? saved : item,
          ),
        };
      }),
    deleteTemplate: (template: BudgetTemplate) =>
      run(async () => {
        if (!state) throw new Error("Open the template manager again.");
        await repository.deleteTemplate(template.id, template.updatedAt);
        return {
          ...state,
          templates: state.templates.filter((item) => item.id !== template.id),
        };
      }),
  };
}
