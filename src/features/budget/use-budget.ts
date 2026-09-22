import { useCallback, useEffect, useRef, useState } from "react";
import { useBudgetRepository } from "../../db/context";
import {
  applyLeftoverCarry,
  assignLeftoverToSpending,
  releaseSpending,
  applyTemplateToMonth,
  clearMonthActuals,
  copyBudget,
  createBlankMonth,
  createTemplate,
  defaultGroupPresentation,
  groupPresentationFor,
  instantiateTemplate,
  renameTemplate,
  replaceTemplateStructure,
  type BudgetDocument,
  type BudgetTemplate,
  type GroupPresentation,
  type GroupRowSort,
} from "../../domain/budget";
import { initialiseBudget, type BudgetState } from "./initialise";
import { notifyBudgetChanged, subscribeBudgetChanges } from "./changes";
import { shareBudgetArchive } from "./backup-transfer";
import type { BudgetArchive } from "../../domain/backup";
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
      groupPresentation: state?.groupPresentation ?? {},
      autoApplyRecentMonth: state?.autoApplyRecentMonth ?? false,
    };
  }

  function patchPresentation(
    groupId: string,
    patch: Partial<GroupPresentation>,
  ) {
    setState((current) => {
      if (!current) return current;
      const next = {
        ...current.groupPresentation,
        [groupId]: {
          ...defaultGroupPresentation,
          ...current.groupPresentation[groupId],
          ...patch,
        },
      };
      void repository.saveGroupPresentation(next).catch(() => undefined);
      return { ...current, groupPresentation: next };
    });
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
    createMonth: (
      sourceId?: string,
      templateId?: string,
      options?: { carryLeftover?: boolean; year?: number; month?: number },
    ) =>
      run(async () => {
        if (!state) throw new Error("Choose a month first.");
        const year = options?.year ?? state.period.year;
        const month = options?.month ?? state.period.month;
        if (sourceId) {
          const source = await repository.loadMonth(sourceId);
          if (!source) throw new Error("The source month could not be found.");
          const copied = copyBudget(source, year, month);
          return committed(
            options?.carryLeftover
              ? applyLeftoverCarry(source, copied)
              : copied,
          );
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
    setSpending: (enabled: boolean) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a budget first.");
        const next = enabled
          ? assignLeftoverToSpending(state.document)
          : releaseSpending(state.document);
        if (next === state.document) return state;
        return committed(next);
      }),
    setLocked: (locked: boolean) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a budget first.");
        const month = state.document.month;
        return savedState(
          await repository.setMonthLocked(month.id, month.revision, locked),
        );
      }),
    resetMonth: () =>
      run(async () => {
        if (!state?.document) throw new Error("Open a budget first.");
        return committed(clearMonthActuals(state.document));
      }),
    applyTemplate: (templateId: string) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a budget first.");
        const template = await repository.loadTemplate(templateId);
        if (!template) throw new Error("The template could not be found.");
        return committed(applyTemplateToMonth(state.document, template));
      }),
    saveTemplate: (name: string) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a budget first.");
        const saved = await repository.saveTemplate(
          createTemplate(state.document, name),
        );
        const document = await repository.setMonthTemplateId(
          state.document.month.id,
          state.document.month.revision,
          saved.id,
        );
        notifyBudgetChanged();
        return {
          ...savedState(document),
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
        notifyBudgetChanged();
        return {
          ...state,
          templates: [
            ...state.templates.filter((item) => item.id !== saved.id),
            saved,
          ].sort((a, b) => a.name.localeCompare(b.name)),
        };
      }),
    replaceTemplate: (
      template: BudgetTemplate,
      options?: { attach?: boolean },
    ) =>
      run(async () => {
        if (!state?.document) throw new Error("Open a saved month first.");
        const saved = await repository.saveTemplate(
          replaceTemplateStructure(template, state.document),
        );
        const document =
          options?.attach && state.document.month.templateId !== saved.id
            ? await repository.setMonthTemplateId(
                state.document.month.id,
                state.document.month.revision,
                saved.id,
              )
            : state.document;
        notifyBudgetChanged();
        return {
          ...state,
          document,
          months: state.months.map((month) =>
            month.id === document.month.id ? document.month : month,
          ),
          templates: state.templates.map((item) =>
            item.id === saved.id ? saved : item,
          ),
        };
      }),
    deleteTemplate: (template: BudgetTemplate) =>
      run(async () => {
        if (!state) throw new Error("Open the template manager again.");
        await repository.deleteTemplate(template.id, template.updatedAt);
        notifyBudgetChanged();
        const document =
          state.document?.month.templateId === template.id
            ? {
                ...state.document,
                month: { ...state.document.month, templateId: undefined },
              }
            : state.document;
        return {
          ...state,
          document,
          months: state.months.map((month) =>
            month.templateId === template.id
              ? { ...month, templateId: undefined }
              : month,
          ),
          templates: state.templates.filter((item) => item.id !== template.id),
        };
      }),
    groupPresentation: (groupId: string) =>
      groupPresentationFor(state?.groupPresentation ?? {}, groupId),
    setGroupCollapsed: (groupId: string, collapsed: boolean) =>
      patchPresentation(groupId, { collapsed }),
    collapseAllGroups: () => {
      setState((current) => {
        if (!current?.document) return current;
        const next = { ...current.groupPresentation };
        for (const group of current.document.groups) {
          next[group.id] = {
            ...defaultGroupPresentation,
            ...next[group.id],
            collapsed: true,
          };
        }
        void repository.saveGroupPresentation(next).catch(() => undefined);
        return { ...current, groupPresentation: next };
      });
    },
    setGroupSort: (groupId: string, sort: GroupRowSort) =>
      patchPresentation(groupId, { sort }),
    exportArchive: () =>
      run(async () => {
        if (!state)
          throw new Error("Open your budgets before saving a backup.");
        await shareBudgetArchive(await repository.exportStore());
        return state;
      }),
    restoreArchive: (archive: BudgetArchive) =>
      run(async () => {
        await repository.restoreStore(archive);
        notifyBudgetChanged();
        return initialise();
      }),
    setAutoApplyRecentMonth: (value: boolean) =>
      run(async () => {
        await repository.setAutoApplyRecentMonth(value);
        notifyBudgetChanged();
        return initialise();
      }),
  };
}
