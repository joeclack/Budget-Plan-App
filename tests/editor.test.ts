import assert from "node:assert/strict";
import test from "node:test";
import { createBudgetFixture as createExampleBudget } from "./budget-fixture";
import {
  createTemplate,
  evaluateBudget,
  instantiateTemplate,
  reorderGroups,
} from "../src/domain/budget";
import {
  deletionDraft,
  editGroup,
  editRow,
  expressionText,
  parseExpression,
  referenceChoices,
} from "../src/domain/budget/editor";

test("row drafts rename, move, change rule and notes atomically without touching source or template", () => {
  const original = createExampleBudget(2026, 9);
  const snapshot = JSON.stringify(original);
  const template = createTemplate(original, "Household");
  const salary = original.rows.find((row) => row.label === "Salary")!;
  const giving = original.rows.find((row) => row.rule.kind === "percentage")!;
  const destination = original.groups.find(
    (group) => group.classification === "saving",
  )!;
  const draft = editRow(
    original,
    {
      ...giving,
      groupId: destination.id,
      label: "Future giving",
      notes: "Set aside",
      rule: {
        kind: "percentage",
        rate: "12.5",
        source: { kind: "row", id: salary.id },
      },
    },
    giving.id,
  );
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(draft.month.revision, original.month.revision);
  assert.equal(
    draft.rows.find((row) => row.id === giving.id)?.groupId,
    destination.id,
  );
  assert.deepEqual(evaluateBudget(draft).rows[giving.id], {
    ok: true,
    amountMinor: 42750,
  });
  assert.deepEqual(
    evaluateBudget(instantiateTemplate(template, 2026, 10)).leftToPlan,
    evaluateBudget(original).leftToPlan,
  );
});

test("group classification and new rows change the monthly preview", () => {
  const original = createExampleBudget(2026, 9);
  const draft = editGroup(original, {
    title: "Side income",
    classification: "income",
  });
  const group = draft.groups.at(-1)!;
  const withRow = editRow(draft, {
    label: "Sales",
    notes: "",
    groupId: group.id,
    allocationRole: "allocation",
    rule: { kind: "fixed", amountMinor: 10000 },
  });
  assert.deepEqual(evaluateBudget(withRow).leftToPlan, {
    ok: true,
    amountMinor: 64500,
  });
  const spending = editGroup(
    withRow,
    { title: "Sales costs", classification: "expense" },
    group.id,
  );
  assert.deepEqual(evaluateBudget(spending).leftToPlan, {
    ok: true,
    amountMinor: 44500,
  });
});

test("expression editor preserves arithmetic precedence, brackets, unary signs and named references", () => {
  const original = createExampleBudget(2026, 9);
  const choices = referenceChoices(original);
  const salary = original.rows.find((row) => row.label === "Salary")!;
  const token = choices.find(
    (choice) => choice.reference.id === salary.id,
  )!.token;
  const expression = parseExpression(
    `([${token}] - 500) * .1 + -(2 + 3) / 2`,
    choices,
  );
  const draft = editRow(original, {
    label: "Formula",
    notes: "",
    groupId: original.groups[0].id,
    allocationRole: "informational",
    rule: { kind: "expression", expression },
  });
  assert.deepEqual(evaluateBudget(draft).rows[draft.rows.at(-1)!.id], {
    ok: true,
    amountMinor: 28950,
  });
  assert.deepEqual(
    parseExpression(expressionText(expression, choices), choices),
    expression,
  );
  assert.deepEqual(parseExpression("1 + 2 * 3", []), {
    kind: "binary",
    operator: "+",
    left: { kind: "literal", value: "1" },
    right: {
      kind: "binary",
      operator: "*",
      left: { kind: "literal", value: "2" },
      right: { kind: "literal", value: "3" },
    },
  });
});

test("ambiguous names get unique reference tokens and resolve to stable IDs after renaming", () => {
  const original = createExampleBudget(2026, 9);
  const first = original.rows[0];
  const added = editRow(original, {
    ...first,
    notes: "",
    rule: { kind: "fixed", amountMinor: 100 },
  });
  const choices = referenceChoices(added);
  assert.equal(
    new Set(choices.map((choice) => choice.token)).size,
    choices.length,
  );
  const target = choices.find(
    (choice) => choice.reference.id === added.rows.at(-1)!.id,
  )!;
  const expression = parseExpression(`[${target.token}]`, choices);
  const renamed = editRow(
    added,
    { ...added.rows.at(-1)!, label: "Different name" },
    added.rows.at(-1)!.id,
  );
  const reordered = reorderGroups(
    renamed,
    renamed.groups.map((group) => group.id).reverse(),
  );
  assert.deepEqual(
    parseExpression(
      expressionText(expression, referenceChoices(reordered)),
      referenceChoices(reordered),
    ),
    expression,
  );
});

test("invalid, executable, incomplete and overly nested expression text is rejected", () => {
  for (const text of [
    "",
    "1 +",
    "(1 + 2",
    "1 2",
    "[unknown]",
    "process.exit()",
    "1e9",
    "1,000",
    "2 ** 3",
    "(".repeat(70) + "1" + ")".repeat(70),
    "1+".repeat(200) + "1",
  ]) {
    assert.throws(() => parseExpression(text, []), Error, text);
  }
});

test("draft validation rejects division by zero, cycles and edits to locked months", () => {
  const original = createExampleBudget(2026, 9);
  const row = original.rows[0];
  assert.throws(
    () =>
      editRow(
        original,
        {
          ...row,
          rule: {
            kind: "expression",
            expression: parseExpression("1 / 0", []),
          },
        },
        row.id,
      ),
    /zero/,
  );
  assert.throws(
    () =>
      editRow(
        original,
        {
          ...row,
          rule: {
            kind: "percentage",
            rate: "10",
            source: { kind: "row", id: row.id },
          },
        },
        row.id,
      ),
    /[Cc]ircular/,
  );
  const locked = { ...original, month: { ...original.month, isLocked: true } };
  assert.throws(
    () => editGroup(locked, { title: "New", classification: "expense" }),
    /Unlock/,
  );
  assert.throws(() => editRow(locked, row, row.id), /Unlock/);
  assert.throws(
    () => deletionDraft(locked, { kind: "row", id: row.id }),
    /Unlock/,
  );
});

test("deletion lists dependent rules and permits safe removals with recalculated totals", () => {
  const original = createExampleBudget(2026, 9);
  const salary = original.rows.find((row) => row.label === "Salary")!;
  const blocked = deletionDraft(original, { kind: "row", id: salary.id });
  assert.ok(
    blocked.affected.includes(
      original.rows.find((row) => row.rule.kind === "percentage")!.label,
    ),
  );
  const subscriptions = original.groups.find(
    (group) => group.title === "Subscriptions",
  )!;
  assert.ok(
    deletionDraft(original, {
      kind: "group",
      id: subscriptions.id,
    }).affected.includes("Subscriptions total"),
  );
  const rent = original.rows.find((row) => row.label === "Rent")!;
  const allowed = deletionDraft(original, { kind: "row", id: rent.id });
  assert.deepEqual(allowed.affected, []);
  assert.deepEqual(evaluateBudget(allowed.draft).leftToPlan, {
    ok: true,
    amountMinor: 164500,
  });
  assert.ok(original.rows.some((row) => row.id === rent.id));
});
