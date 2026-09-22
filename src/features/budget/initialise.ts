import type { BudgetRepository } from "../../db/repository";
import {
  copyBudget,
  missingCurrentMonth,
  type GroupPresentationMap,
} from "../../domain/budget";
import type {
  BudgetDocument,
  BudgetMonth,
  BudgetTemplate,
} from "../../domain/budget/types";

export type BudgetState = {
  document: BudgetDocument | null;
  months: BudgetMonth[];
  templates: BudgetTemplate[];
  period: { year: number; month: number };
  groupPresentation: GroupPresentationMap;
  autoApplyRecentMonth: boolean;
};

const pending = new WeakMap<BudgetRepository, Promise<BudgetState>>();

/** Concurrent mounts share one open operation. A new installation starts empty. */
export function initialiseBudget(
  repository: BudgetRepository,
  now = new Date(),
): Promise<BudgetState> {
  const existing = pending.get(repository);
  if (existing) return existing;
  const task = openBudget(repository, now).finally(() =>
    pending.delete(repository),
  );
  pending.set(repository, task);
  return task;
}

async function openBudget(
  repository: BudgetRepository,
  now: Date,
): Promise<BudgetState> {
  await repository.removeDemoData();
  let months = await repository.listMonths();
  const autoApplyRecentMonth = await repository.getAutoApplyRecentMonth();
  const applied = await applyRecentMonthIfDue(
    repository,
    months,
    autoApplyRecentMonth,
    now,
  );
  if (applied) {
    months = [
      applied.month,
      ...months.filter((month) => month.id !== applied.month.id),
    ].sort((a, b) => b.year - a.year || b.month - a.month);
  }
  const selectedId = await repository.getSelectedMonthId();
  let document = applied
    ? applied
    : selectedId
      ? await repository.loadMonth(selectedId)
      : null;
  if (!document && months.length)
    document = await repository.loadMonth(months[0].id);
  if (document) await repository.setSelectedMonthId(document.month.id);
  return {
    document,
    months,
    templates: await repository.listTemplates(),
    period: document
      ? { year: document.month.year, month: document.month.month }
      : { year: now.getFullYear(), month: now.getMonth() + 1 },
    groupPresentation: await repository
      .getGroupPresentation()
      .catch(() => ({})),
    autoApplyRecentMonth,
  };
}

async function applyRecentMonthIfDue(
  repository: BudgetRepository,
  months: BudgetMonth[],
  enabled: boolean,
  now: Date,
) {
  if (!enabled) return null;
  const missing = missingCurrentMonth(months, now);
  if (!missing?.source) return null;
  const source = await repository.loadMonth(missing.source.id);
  if (!source) return null;
  return repository.saveMonth(copyBudget(source, missing.year, missing.month));
}
