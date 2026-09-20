import type { BudgetRepository } from "../../db/repository";
import type {
  BudgetDocument,
  BudgetMonth,
  BudgetTemplate,
} from "../../domain/budget/types";
import { createExampleBudget } from "../../data/example-budget";

export type BudgetState = {
  document: BudgetDocument | null;
  months: BudgetMonth[];
  templates: BudgetTemplate[];
  period: { year: number; month: number };
};

const pending = new WeakMap<BudgetRepository, Promise<BudgetState>>();

/** Concurrent mounts share one first-run seed; reopening never replaces saved data. */
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
  const months = await repository.listMonths();
  const selectedId = await repository.getSelectedMonthId();
  let document = selectedId ? await repository.loadMonth(selectedId) : null;
  if (!document && months.length)
    document = await repository.loadMonth(months[0].id);
  if (!document) {
    const now = new Date();
    const example = createExampleBudget(now.getFullYear(), now.getMonth() + 1);
    try {
      document = await repository.saveMonth(example);
    } catch (error) {
      // Another mounted connection may have completed first-run creation.
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "DUPLICATE_MONTH"
      )
        throw error;
      document = await repository.findMonth(
        example.month.year,
        example.month.month,
      );
      if (!document) throw error;
    }
  }
  await repository.setSelectedMonthId(document.month.id);
  return {
    document,
    months: await repository.listMonths(),
    templates: await repository.listTemplates(),
    period: { year: document.month.year, month: document.month.month },
  };
}
