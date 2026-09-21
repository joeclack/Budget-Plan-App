import {
  assertValidBudget,
  createBlankMonth,
  newId,
} from "../src/domain/budget";
import type {
  AmountRule,
  BudgetDocument,
  Classification,
} from "../src/domain/budget";

export function createBudgetFixture(year = 2026, month = 9): BudgetDocument {
  const document = createBlankMonth(year, month);
  document.month.name = "Household";
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
      dueDay: null,
      allocationRole: informational ? "informational" : "allocation",
      sortOrder: document.rows.filter((item) => item.groupId === groupId)
        .length,
    });
    return id;
  }
  const income = group("Income", "income"),
    bills = group("Bills", "expense"),
    subscriptions = group("Subscriptions", "expense"),
    giving = group("Giving", "expense"),
    savings = group("Savings", "saving");
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
