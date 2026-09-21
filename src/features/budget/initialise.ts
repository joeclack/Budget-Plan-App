import type { BudgetRepository } from "../../db/repository";
import type { GroupPresentationMap } from "../../domain/budget";
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
};

const pending = new WeakMap<BudgetRepository, Promise<BudgetState>>();

/** Concurrent mounts share one open operation. A new installation starts empty. */
export function initialiseBudget(
  repository: BudgetRepository,
): Promise<BudgetState> {
  const existing = pending.get(repository);
  if (existing) return existing;
  const task = openBudget(repository).finally(() => pending.delete(repository));
  pending.set(repository, task);
  return task;
}

async function openBudget(repository: BudgetRepository): Promise<BudgetState> {
  await repository.removeDemoData();
  const months = await repository.listMonths();
  const selectedId = await repository.getSelectedMonthId();
  let document = selectedId ? await repository.loadMonth(selectedId) : null;
  if (!document && months.length)
    document = await repository.loadMonth(months[0].id);
  const now = new Date();
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
  };
}
