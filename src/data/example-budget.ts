import { assertValidBudget, createBlankMonth, newId } from "../domain/budget";
import type {
  AmountRule,
  BudgetDocument,
  Classification,
} from "../domain/budget/types";

/** Seeds only a new installation; all subsequent values come from storage. */
export function createExampleBudget(
  year: number,
  month: number,
): BudgetDocument {
  const document = createBlankMonth(year, month);
  document.month.name = "Example budget";
  function group(title: string, classification: Classification) {
    const id = newId();
    document.groups.push({
      id,
      monthId: document.month.id,
      title,
      classification,
      sortOrder: document.groups.length,
    });
    return id;
  }
  function row(
    groupId: string,
    label: string,
    rule: AmountRule,
    informational = false,
  ) {
    const id = newId();
    document.rows.push({
      id,
      groupId,
      label,
      rule,
      notes: "",
      allocationRole: informational ? "informational" : "allocation",
      sortOrder: document.rows.filter((item) => item.groupId === groupId)
        .length,
    });
    return id;
  }
  const income = group("Income", "income");
  const bills = group("Bills", "expense");
  const subscriptions = group("Subscriptions", "expense");
  const giving = group("Giving", "expense");
  const savings = group("Savings", "saving");
  const salary = row(income, "Salary", { kind: "fixed", amountMinor: 342000 });
  row(bills, "Rent", { kind: "fixed", amountMinor: 110000 });
  row(bills, "Car finance", { kind: "fixed", amountMinor: 23300 });
  row(subscriptions, "Broadband", { kind: "fixed", amountMinor: 4000 });
  row(subscriptions, "Mobile", { kind: "fixed", amountMinor: 2500 });
  row(subscriptions, "Memberships", { kind: "fixed", amountMinor: 19500 });
  row(
    bills,
    "Subscriptions total",
    { kind: "groupTotal", groupId: subscriptions },
    true,
  );
  row(giving, "Giving", {
    kind: "percentage",
    rate: "10",
    source: { kind: "row", id: salary },
  });
  row(savings, "Savings", { kind: "fixed", amountMinor: 94000 });
  assertValidBudget(document);
  return document;
}
