import { paymentDate } from "./schedule";
import type { AmountResult, BudgetRow } from "./types";

export const groupRowSorts = [
  "planned",
  "amountAsc",
  "amountDesc",
  "date",
] as const;

export type GroupRowSort = (typeof groupRowSorts)[number];

function amountValue(result: AmountResult | undefined) {
  return result?.ok ? result.amountMinor : null;
}

function dueTime(
  row: BudgetRow,
  calendar: { year: number; month: number },
) {
  return row.dueDay == null
    ? null
    : paymentDate(calendar.year, calendar.month, row.dueDay).getTime();
}

function compareOptional(
  a: number | null,
  b: number | null,
  direction: 1 | -1,
) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a - b) * direction;
}

export function sortGroupRows(
  rows: readonly BudgetRow[],
  amounts: Record<string, AmountResult>,
  sort: GroupRowSort,
  calendar: { year: number; month: number },
) {
  return [...rows].sort((left, right) => {
    const planned = left.sortOrder - right.sortOrder;
    if (sort === "planned") return planned;
    if (sort === "date") {
      return (
        compareOptional(
          dueTime(left, calendar),
          dueTime(right, calendar),
          1,
        ) || planned
      );
    }
    return (
      compareOptional(
        amountValue(amounts[left.id]),
        amountValue(amounts[right.id]),
        sort === "amountDesc" ? -1 : 1,
      ) || planned
    );
  });
}
