import assert from "node:assert/strict";
import test from "node:test";
import {
  addGroup,
  addRow,
  assertValidBudget,
  assertValidTemplate,
  copyBudget,
  createBlankMonth,
  createTemplate,
  describeRule,
  evaluateBudget,
  formatMinor,
  instantiateTemplate,
  moveRow,
  newId,
  parseMoney,
  removeGroup,
  removeRow,
  renameGroup,
  renameRow,
  reorderGroups,
  reorderRows,
  setRowRule,
  type AmountResult,
  type BudgetDocument,
  type BudgetReference,
  type Expression,
} from "../src/domain/budget/index";

const fixed = (amountMinor: number) => ({
  kind: "fixed" as const,
  amountMinor,
});
const literal = (value: string): Expression => ({ kind: "literal", value });
const ref = (id: string, kind: "row" | "group" = "row"): BudgetReference => ({
  kind,
  id,
});
const binary = (
  operator: "+" | "-" | "*" | "/",
  left: Expression,
  right: Expression,
): Expression => ({ kind: "binary", operator, left, right });
function value(result: AmountResult): number {
  if (!result.ok) throw new Error(result.error.message);
  return result.amountMinor;
}
function errorCode(result: AmountResult, code: string) {
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, code);
}
function sample(): BudgetDocument {
  return {
    month: {
      id: "month",
      year: 2026,
      month: 9,
      name: "September 2026",
      isLocked: false,
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
      revision: 3,
    },
    groups: [
      {
        id: "income",
        monthId: "month",
        title: "Income",
        classification: "income",
        sortOrder: 0,
      },
      {
        id: "bills",
        monthId: "month",
        title: "Bills",
        classification: "expense",
        sortOrder: 1,
      },
      {
        id: "saving",
        monthId: "month",
        title: "Savings",
        classification: "saving",
        sortOrder: 2,
      },
    ],
    rows: [
      {
        id: "salary",
        groupId: "income",
        label: "Salary",
        notes: "",
        rule: fixed(100000),
        allocationRole: "allocation",
        sortOrder: 0,
      },
      {
        id: "rent",
        groupId: "bills",
        label: "Rent",
        notes: "",
        rule: fixed(50000),
        allocationRole: "allocation",
        sortOrder: 0,
      },
      {
        id: "phone",
        groupId: "bills",
        label: "Phone",
        notes: "",
        rule: fixed(10000),
        allocationRole: "allocation",
        sortOrder: 1,
      },
      {
        id: "bill-total",
        groupId: "bills",
        label: "Bill subtotal",
        notes: "",
        rule: { kind: "groupTotal", groupId: "bills" },
        allocationRole: "informational",
        sortOrder: 2,
      },
      {
        id: "tithe",
        groupId: "saving",
        label: "Tithe",
        notes: "",
        rule: {
          kind: "percentage",
          rate: "10",
          source: ref("income", "group"),
        },
        allocationRole: "allocation",
        sortOrder: 0,
      },
      {
        id: "remainder",
        groupId: "saving",
        label: "Available",
        notes: "",
        rule: {
          kind: "expression",
          expression: binary(
            "-",
            binary("-", ref("income", "group"), ref("bills", "group")),
            ref("tithe"),
          ),
        },
        allocationRole: "informational",
        sortOrder: 1,
      },
    ],
  };
}

test("fixed, group, percentage and nested arithmetic use explicit allocation roles", () => {
  const doc = sample();
  assertValidBudget(doc);
  const totals = evaluateBudget(doc);
  assert.equal(value(totals.income), 100000);
  assert.equal(value(totals.groups.bills), 60000);
  assert.equal(value(totals.rows["bill-total"]), 60000);
  assert.equal(value(totals.rows.tithe), 10000);
  assert.equal(value(totals.allocated), 70000);
  assert.equal(value(totals.rows.remainder), 30000);
  assert.equal(value(totals.leftToPlan), 30000);
});

test("empty groups and blank months produce real zero values", () => {
  const doc = addGroup(createBlankMonth(2026, 10), "Empty", "expense");
  const totals = evaluateBudget(doc);
  assert.equal(value(totals.groups[doc.groups[0].id]), 0);
  assert.equal(value(totals.income), 0);
  assert.equal(value(totals.allocated), 0);
  assert.equal(value(totals.leftToPlan), 0);
});

test("overspending stays negative, as do negative row amounts", () => {
  const doc = setRowRule(sample(), "salary", fixed(10000));
  assert.equal(value(evaluateBudget(doc).leftToPlan), -51000);
  const refund = setRowRule(sample(), "phone", fixed(-2000));
  assert.equal(value(evaluateBudget(refund).groups.bills), 48000);
});

test("round once per row, exactly, with halves away from zero", () => {
  let doc = sample();
  doc = setRowRule(doc, "salary", fixed(4));
  doc = setRowRule(doc, "tithe", {
    kind: "percentage",
    rate: "12.5",
    source: ref("salary"),
  });
  assert.equal(value(evaluateBudget(doc).rows.tithe), 1);
  doc = setRowRule(doc, "salary", fixed(-4));
  assert.equal(value(evaluateBudget(doc).rows.tithe), -1);
  doc = setRowRule(doc, "tithe", {
    kind: "expression",
    expression: binary(
      "*",
      binary("/", literal("0.01"), literal("3")),
      literal("3"),
    ),
  });
  assert.equal(value(evaluateBudget(doc).rows.tithe), 1);
  doc = setRowRule(doc, "phone", {
    kind: "expression",
    expression: literal("1.005"),
  });
  assert.equal(value(evaluateBudget(doc).rows.phone), 101);
  doc = setRowRule(doc, "phone", {
    kind: "expression",
    expression: literal("-1.005"),
  });
  assert.equal(value(evaluateBudget(doc).rows.phone), -101);
});

test("references consume a row's rounded pennies", () => {
  let doc = setRowRule(sample(), "phone", {
    kind: "expression",
    expression: literal("0.005"),
  });
  doc = setRowRule(doc, "tithe", {
    kind: "expression",
    expression: binary("*", ref("phone"), literal("3")),
  });
  assert.equal(value(evaluateBudget(doc).rows.phone), 1);
  assert.equal(value(evaluateBudget(doc).rows.tithe), 3);
});

test("new group members affect group references but not specific row references", () => {
  let doc = setRowRule(sample(), "tithe", {
    kind: "percentage",
    rate: "10",
    source: ref("salary"),
  });
  doc = addRow(doc, "income", "Bonus", fixed(25000));
  const totals = evaluateBudget(doc);
  assert.equal(value(totals.income), 125000);
  assert.equal(value(totals.rows.tithe), 10000);
  assert.equal(value(totals.rows.remainder), 55000);
  doc = setRowRule(doc, "tithe", {
    kind: "percentage",
    rate: "10",
    source: ref("income", "group"),
  });
  assert.equal(value(evaluateBudget(doc).rows.tithe), 12500);
});

test("renaming, reordering and moving preserve stable row references", () => {
  const source = sample();
  let doc = renameRow(source, "salary", "Monthly pay");
  doc = renameGroup(doc, "bills", "Living costs");
  doc = reorderGroups(doc, ["saving", "bills", "income"]);
  doc = reorderRows(doc, "bills", ["bill-total", "phone", "rent"]);
  assert.equal(value(evaluateBudget(doc).leftToPlan), 30000);
  assert.equal(value(evaluateBudget(doc).rows.remainder), 30000);
  doc = moveRow(doc, "rent", "saving", 0);
  assert.equal(value(evaluateBudget(doc).allocated), 70000);
  assert.equal(value(evaluateBudget(doc).rows.rent), 50000);
  assert.equal(value(evaluateBudget(doc).rows["bill-total"]), 10000);
  assert.equal(doc.month.revision, source.month.revision);
  assert.equal(source.rows.find((row) => row.id === "salary")?.label, "Salary");
  assert.equal(source.groups[0].id, "income");
  assert.match(
    describeRule(doc.rows.find((row) => row.id === "bill-total")!.rule, doc),
    /Living costs/,
  );
});

test("missing references propagate to dependent rows, groups and summaries", () => {
  const doc = sample();
  doc.rows.find((row) => row.id === "rent")!.rule = {
    kind: "percentage",
    rate: "10",
    source: ref("deleted"),
  };
  const totals = evaluateBudget(doc);
  for (const result of [
    totals.rows.rent,
    totals.rows["bill-total"],
    totals.rows.remainder,
    totals.groups.bills,
    totals.allocated,
    totals.leftToPlan,
  ])
    errorCode(result, "missing_reference");
  assert.equal(value(totals.income), 100000);
  assert.throws(() => assertValidBudget(doc), /missing/);
});

test("direct and indirect row/group cycles are rejected", () => {
  const doc = sample();
  doc.rows.find((row) => row.id === "rent")!.rule = {
    kind: "expression",
    expression: ref("phone"),
  };
  doc.rows.find((row) => row.id === "phone")!.rule = {
    kind: "expression",
    expression: ref("rent"),
  };
  const totals = evaluateBudget(doc);
  errorCode(totals.rows.rent, "cycle");
  errorCode(totals.rows.phone, "cycle");
  errorCode(totals.leftToPlan, "cycle");
  assert.throws(() => assertValidBudget(doc), /circular/);
  const ownTotal = sample();
  ownTotal.rows.find((row) => row.id === "bill-total")!.allocationRole =
    "allocation";
  errorCode(evaluateBudget(ownTotal).groups.bills, "cycle");
});

test("division by zero propagates instead of becoming a zero amount", () => {
  const doc = sample();
  doc.rows.find((row) => row.id === "rent")!.rule = {
    kind: "expression",
    expression: binary(
      "/",
      literal("1"),
      binary("-", ref("salary"), ref("salary")),
    ),
  };
  const totals = evaluateBudget(doc);
  errorCode(totals.rows.rent, "division_by_zero");
  errorCode(totals.groups.bills, "division_by_zero");
  errorCode(totals.leftToPlan, "division_by_zero");
  assert.throws(() => assertValidBudget(doc), /zero/);
});

test("invalid informational rows still prevent saving without double counting them", () => {
  const doc = sample();
  doc.rows.find((row) => row.id === "remainder")!.rule = {
    kind: "groupTotal",
    groupId: "missing",
  };
  assert.equal(value(evaluateBudget(doc).leftToPlan), 30000);
  assert.throws(() => assertValidBudget(doc), /missing/);
});

test("unsafe persisted money, computed rows and totals cannot pass validation", () => {
  const doc = sample();
  doc.rows[0].rule = fixed(Number.MAX_SAFE_INTEGER + 1);
  errorCode(evaluateBudget(doc).income, "invalid_data");
  assert.throws(() => assertValidBudget(doc), /range/);
  doc.rows[0].rule = {
    kind: "expression",
    expression: literal("90071992547409.92"),
  };
  errorCode(evaluateBudget(doc).rows.salary, "overflow");
  doc.rows[0].rule = fixed(Number.MAX_SAFE_INTEGER);
  doc.rows[1].rule = fixed(Number.MAX_SAFE_INTEGER);
  errorCode(evaluateBudget(doc).groups.bills, "overflow");
});

test("sum pennies as integers, including cancellation near the safe limit", () => {
  const doc = sample();
  doc.rows = doc.rows.filter((row) =>
    ["salary", "rent", "phone"].includes(row.id),
  );
  doc.rows[0].rule = fixed(0);
  doc.rows[1].rule = fixed(Number.MAX_SAFE_INTEGER);
  doc.rows[2].rule = fixed(-Number.MAX_SAFE_INTEGER);
  assert.equal(value(evaluateBudget(doc).leftToPlan), 0);
});

test("money parsing distinguishes blank and invalid from explicit zero", () => {
  assert.equal(parseMoney("0"), 0);
  assert.equal(parseMoney(" 12.34 "), 1234);
  assert.equal(parseMoney("-.5"), -50);
  assert.equal(parseMoney("-1.01"), -101);
  assert.equal(parseMoney("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  for (const invalid of [
    "",
    " ",
    "NaN",
    "Infinity",
    "1e3",
    "1.001",
    "1,000",
    "£2",
    "--1",
    "90071992547409.92",
  ])
    assert.throws(() => parseMoney(invalid));
  assert.equal(formatMinor(-123456), "-£1,234.56");
  assert.equal(formatMinor(0), "£0.00");
  assert.equal(formatMinor(Number.MAX_SAFE_INTEGER), "£90,071,992,547,409.91");
  assert.throws(() => formatMinor(1.5));
});

test("all copy and template references are remapped with detached identities", () => {
  const source = sample();
  const copied = copyBudget(source, 2026, 10);
  const template = createTemplate(source, "Usual month");
  const instance = instantiateTemplate(template, 2027, 1);
  assertValidTemplate(template);
  const originalIds = new Set([
    source.month.id,
    ...source.groups.map((group) => group.id),
    ...source.rows.map((row) => row.id),
  ]);
  const references = (expression: Expression): string[] =>
    expression.kind === "binary"
      ? [...references(expression.left), ...references(expression.right)]
      : expression.kind === "literal"
        ? []
        : [expression.id];
  for (const doc of [copied, instance]) {
    assertValidBudget(doc);
    assert.equal(doc.month.revision, 0);
    assert.equal(doc.month.isLocked, false);
    assert.equal(value(evaluateBudget(doc).leftToPlan), 30000);
    for (const id of [
      doc.month.id,
      ...doc.groups.flatMap((group) => [group.id, group.monthId]),
      ...doc.rows.flatMap((row) => {
        const rule = row.rule;
        return [
          row.id,
          row.groupId,
          ...(rule.kind === "percentage"
            ? [rule.source.id]
            : rule.kind === "groupTotal"
              ? [rule.groupId]
              : rule.kind === "expression"
                ? references(rule.expression)
                : []),
        ];
      }),
    ])
      assert.equal(originalIds.has(id), false, id);
  }
  assert.ok(
    template.structure.groups.every((group) => group.monthId === template.id),
  );
  const copiedSalary = copied.rows.find((row) => row.label === "Salary")!;
  const modified = setRowRule(copied, copiedSalary.id, fixed(200000));
  assert.equal(value(evaluateBudget(modified).income), 200000);
  assert.equal(value(evaluateBudget(source).income), 100000);
  assert.equal(value(evaluateBudget(instance).income), 100000);
  copied.rows[0].notes = "Changed copy";
  assert.equal(source.rows[0].notes, "");
  assert.equal(template.structure.rows[0].notes, "");
});

test("templates reject external references and unsupported schemas", () => {
  const template = createTemplate(sample(), "Reusable");
  template.structure.rows[0].rule = { kind: "groupTotal", groupId: "income" };
  assert.throws(() => assertValidTemplate(template), /missing/);
  assert.throws(
    () =>
      assertValidTemplate({
        ...template,
        structure: { ...template.structure, version: 2 },
      }),
    /version/,
  );
  assert.throws(() => createTemplate(sample(), "  "), /non-empty/);
});

test("malformed runtime documents are rejected before calculation or persistence", () => {
  for (const invalid of [null, {}, { month: {} }, { ...sample(), rows: null }])
    assert.throws(() => assertValidBudget(invalid));
  for (const mutate of [
    (doc: BudgetDocument) => {
      doc.month.month = 13;
    },
    (doc: BudgetDocument) => {
      doc.month.revision = -1;
    },
    (doc: BudgetDocument) => {
      doc.groups[0].monthId = "other-month";
    },
    (doc: BudgetDocument) => {
      doc.groups[0].title = " ";
    },
    (doc: BudgetDocument) => {
      doc.rows[1].id = doc.rows[0].id;
    },
    (doc: BudgetDocument) => {
      doc.rows[0].groupId = "deleted";
    },
    (doc: BudgetDocument) => {
      doc.rows[0].rule = {
        kind: "expression",
        expression: literal("process.exit()"),
      };
    },
  ]) {
    const doc = sample();
    mutate(doc);
    assert.throws(() => assertValidBudget(doc));
    errorCode(evaluateBudget(doc).leftToPlan, "invalid_data");
  }
});

test("IDs that match Object prototype keys remain ordinary stable IDs", () => {
  const doc = sample();
  doc.rows[0].id = "__proto__";
  assert.equal(value(evaluateBudget(doc).rows.__proto__), 100000);
  assertValidBudget(doc);
  assert.equal(new Set(Array.from({ length: 1000 }, () => newId())).size, 1000);
});

test("editing helpers reject destructive invalid references and bad reorder input", () => {
  const doc = sample();
  assert.throws(() => removeRow(doc, "tithe"), /missing/);
  assert.throws(() => removeGroup(doc, "income"), /missing/);
  assert.throws(() => reorderGroups(doc, ["income", "income", "saving"]));
  assert.throws(() => reorderRows(doc, "bills", ["phone"]));
  assert.throws(() => moveRow(doc, "phone", "bills", -1));
  assert.equal(sample().rows.length, doc.rows.length);
  const unreferenced = removeRow(doc, "phone");
  assert.equal(value(evaluateBudget(unreferenced).groups.bills), 50000);
});

test("locked months reject editing while copies become independent unlocked months", () => {
  const doc = sample();
  doc.month.isLocked = true;
  assert.throws(() => renameRow(doc, "salary", "New label"), /Unlock/);
  assert.equal(copyBudget(doc, 2026, 10).month.isLocked, false);
  assert.throws(() => createBlankMonth(2026, 0));
  assert.throws(() => createBlankMonth(0, 1));
});
