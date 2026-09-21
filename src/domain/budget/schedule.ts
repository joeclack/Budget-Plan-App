import type { AmountResult, BudgetDocument, BudgetRow } from "./types";

export type ScheduledPayment = {
  row: BudgetRow;
  amount: AmountResult;
  classification: "income" | "expense" | "saving";
  date: Date;
  status: "past" | "today" | "upcoming";
};

export function paymentDate(year: number, month: number, dueDay: number) {
  const finalDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(dueDay, finalDay));
}

export function scheduledPayments(
  document: BudgetDocument,
  amounts: Record<string, AmountResult>,
  now = new Date(),
): ScheduledPayment[] {
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const groups = new Map(document.groups.map((group) => [group.id, group]));
  return document.rows
    .filter((row) => row.dueDay != null && row.allocationRole === "allocation")
    .map((row) => {
      const date = paymentDate(
        document.month.year,
        document.month.month,
        row.dueDay!,
      );
      const time = date.getTime();
      return {
        row,
        amount: amounts[row.id],
        classification: groups.get(row.groupId)!.classification,
        date,
        status: time === today ? "today" : time < today ? "past" : "upcoming",
      } satisfies ScheduledPayment;
    })
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        a.row.sortOrder - b.row.sortOrder,
    );
}

export function dueDateLabel(year: number, month: number, dueDay: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(paymentDate(year, month, dueDay));
}
