import assert from "node:assert/strict";
import test from "node:test";
import {
  addGroup,
  addRow,
  applyLeftoverCarry,
  assignLeftoverToSpending,
  applyTemplateToMonth,
  assertValidBudget,
  assertValidTemplate,
  clearMonthActuals,
  copyBudget,
  currentMonthTemplate,
  createBlankMonth,
  createTemplate,
  describeActual,
  describeRule,
  evaluateBudget,
  formatMinor,
  instantiateTemplate,
  missingCurrentMonth,
  moveRow,
  newId,
  parseMoney,
  removeGroup,
  removeRow,
  renameGroup,
  releaseSpending,
  renameRow,
  reorderGroups,
  reorderRows,
  renameTemplate,
  replaceTemplateStructure,
  setRowActual,
  spendingAmount,
  setRowRule,
  setTemplateRowRule,
  sortGroupRows,
  readGroupPresentationMap,
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
  assert.equal(instance.month.templateId, template.id);
  assert.equal(copied.month.templateId, undefined);
  assert.equal(copyBudget(instance, 2027, 2).month.templateId, template.id);
});

test("applying a template replaces an existing month in place", () => {
  const current = setRowActual(sample(), "rent", 45000);
  const blank = addGroup(createBlankMonth(2026, 1), "Income", "income");
  const planned = addRow(blank, blank.groups[0].id, "Pay", fixed(200000));
  const template = createTemplate(planned, "Simple");
  const applied = applyTemplateToMonth(current, template);
  assert.equal(applied.month.id, current.month.id);
  assert.equal(applied.month.revision, current.month.revision);
  assert.equal(applied.month.year, 2026);
  assert.equal(applied.month.month, 9);
  assert.equal(applied.groups.length, 1);
  assert.equal(applied.groups[0].title, "Income");
  assert.equal(applied.groups[0].monthId, current.month.id);
  assert.equal(applied.rows.length, 1);
  assert.equal(applied.rows[0].label, "Pay");
  assert.equal(applied.rows[0].actualMinor, undefined);
  assert.equal(applied.month.templateId, template.id);
  assert.equal(currentMonthTemplate(applied, [template])?.id, template.id);
  assert.equal(currentMonthTemplate(sample(), [template])?.id, template.id);
  assert.equal(currentMonthTemplate(sample(), []), undefined);
  assert.notEqual(applied.groups[0].id, current.groups[0].id);
  assert.equal(value(evaluateBudget(applied).income), 200000);
  assert.equal(
    current.rows.find((row) => row.id === "rent")?.actualMinor,
    45000,
  );
  const locked = sample();
  locked.month.isLocked = true;
  assert.throws(() => applyTemplateToMonth(locked, template), /Unlock/);
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

test("templates keep row identities when a take-home amount is applied", () => {
  const template = createTemplate(sample(), "Household");
  const salary = template.structure.rows.find((row) => row.label === "Salary")!;
  const updated = setTemplateRowRule(template, salary.id, fixed(301334));
  assert.equal(updated.id, template.id);
  assert.deepEqual(
    updated.structure.rows.find((row) => row.id === salary.id)?.rule,
    fixed(301334),
  );
  assert.deepEqual(
    template.structure.rows.find((row) => row.id === salary.id)?.rule,
    fixed(100000),
  );
});

test("templates can be renamed or replaced without linking back to a month", () => {
  const template = createTemplate(sample(), " Regular month ");
  const renamed = renameTemplate(template, " Updated month ");
  assert.equal(renamed.name, "Updated month");
  assert.equal(template.name, "Regular month");
  assert.throws(() => renameTemplate(template, "  "), /non-empty/);

  const source = sample();
  source.rows[0].rule = fixed(450000);
  source.rows[0].dueDay = 28;
  const updated = replaceTemplateStructure(renamed, source);
  assert.equal(updated.id, template.id);
  assert.equal(updated.createdAt, template.createdAt);
  assert.equal(updated.updatedAt, template.updatedAt);
  assert.ok(
    updated.structure.groups.every((group) => group.monthId === template.id),
  );
  assert.equal(
    value(evaluateBudget(instantiateTemplate(updated, 2027, 2)).income),
    450000,
  );
  assert.equal(
    instantiateTemplate(updated, 2027, 2).rows.find(
      (row) => row.label === "Salary",
    )?.dueDay,
    28,
  );
  assert.notEqual(updated.structure.rows[0].id, source.rows[0].id);
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

test("groups keep a curated colour when copied or saved as a template", () => {
  const doc = sample();
  doc.groups[0].color = "sky";
  assertValidBudget(doc);
  assert.equal(copyBudget(doc, 2026, 10).groups[0].color, "sky");
  assert.equal(
    createTemplate(doc, "Coloured").structure.groups[0].color,
    "sky",
  );
  const invalid = sample();
  (invalid.groups[0] as { color?: string }).color = "neon";
  assert.throws(() => assertValidBudget(invalid), /colour/);
});

test("saved group presentation keeps only known sort and collapse values", () => {
  assert.deepEqual(readGroupPresentationMap(undefined), {});
  assert.deepEqual(
    readGroupPresentationMap({
      bills: { collapsed: true, sort: "amountDesc" },
      junk: { collapsed: "yes", sort: "planned" },
      income: { sort: "date" },
    }),
    {
      bills: { collapsed: true, sort: "amountDesc" },
      income: { collapsed: false, sort: "date" },
    },
  );
});

test("group rows can be sorted by planned order, amount, or payment date", () => {
  const calendar = { year: 2026, month: 2 };
  const rows = [
    {
      id: "late",
      groupId: "bills",
      label: "Late",
      notes: "",
      dueDay: 31,
      rule: fixed(30000),
      allocationRole: "allocation" as const,
      sortOrder: 0,
    },
    {
      id: "early",
      groupId: "bills",
      label: "Early",
      notes: "",
      dueDay: 5,
      rule: fixed(10000),
      allocationRole: "allocation" as const,
      sortOrder: 1,
    },
    {
      id: "undated",
      groupId: "bills",
      label: "Undated",
      notes: "",
      dueDay: null,
      rule: fixed(20000),
      allocationRole: "allocation" as const,
      sortOrder: 2,
    },
    {
      id: "broken",
      groupId: "bills",
      label: "Broken",
      notes: "",
      dueDay: 1,
      rule: fixed(40000),
      allocationRole: "allocation" as const,
      sortOrder: 3,
    },
  ];
  const amounts = {
    late: { ok: true as const, amountMinor: 30000 },
    early: { ok: true as const, amountMinor: 10000 },
    undated: { ok: true as const, amountMinor: 20000 },
    broken: {
      ok: false as const,
      error: { code: "cycle", message: "This row depends on itself." },
    },
  };
  const ids = (sort: Parameters<typeof sortGroupRows>[2]) =>
    sortGroupRows(rows, amounts, sort, calendar).map((row) => row.id);

  assert.deepEqual(ids("planned"), ["late", "early", "undated", "broken"]);
  assert.deepEqual(ids("amountAsc"), ["early", "undated", "late", "broken"]);
  assert.deepEqual(ids("amountDesc"), ["late", "undated", "early", "broken"]);
  assert.deepEqual(ids("date"), ["broken", "early", "late", "undated"]);
});

test("locked months reject editing while copies become independent unlocked months", () => {
  const doc = sample();
  doc.month.isLocked = true;
  assert.throws(() => renameRow(doc, "salary", "New label"), /Unlock/);
  assert.equal(copyBudget(doc, 2026, 10).month.isLocked, false);
  assert.throws(() => createBlankMonth(2026, 0));
  assert.throws(() => createBlankMonth(0, 1));
});

test("actuals do not change the plan and copies start unspent", () => {
  const recorded = setRowActual(sample(), "rent", 45000);
  const totals = evaluateBudget(recorded);
  assert.equal(value(totals.leftToPlan), 30000);
  assert.equal(value(totals.rows.rent), 50000);
  assert.equal(value(totals.actualRows.rent), 45000);
  assert.equal(value(totals.remainingRows.rent), 5000);
  assert.equal(value(totals.actualAllocated), 45000);
  assert.equal(value(totals.leftUnspent), -45000);
  assert.equal(
    describeActual(recorded.rows[1], totals.rows.rent, "expense"),
    "Spent £450.00 · £50.00 left",
  );
  const exact = setRowActual(recorded, "rent", 50000);
  assert.equal(
    describeActual(exact.rows[1], evaluateBudget(exact).rows.rent, "expense"),
    "Spent £500.00 · on plan",
  );
  const over = setRowActual(recorded, "rent", 60000);
  assert.equal(
    describeActual(over.rows[1], evaluateBudget(over).rows.rent, "expense"),
    "Spent £600.00 · £100.00 over",
  );
  assert.equal(copyBudget(recorded, 2026, 10).rows[1].actualMinor, undefined);
  assert.equal(
    createTemplate(recorded, "Reusable").structure.rows.find(
      (row) => row.label === "Rent",
    )?.actualMinor,
    undefined,
  );
  assert.throws(() => setRowActual(sample(), "bill-total", 1), /Display-only/);
  const cleared = clearMonthActuals(recorded);
  assert.equal(
    cleared.rows.find((row) => row.id === "rent")?.actualMinor,
    undefined,
  );
  assert.equal(value(evaluateBudget(cleared).leftToPlan), 30000);
  assert.equal(evaluateBudget(cleared).actualRows.rent, undefined);
  const locked = sample();
  locked.month.isLocked = true;
  locked.rows[1].actualMinor = 45000;
  assert.throws(() => clearMonthActuals(locked), /Unlock/);
});

test("next month can take leftover into the first savings row", () => {
  const blank = createBlankMonth(2026, 9);
  blank.month.revision = 1;
  const withIncome = addGroup(blank, "Income", "income");
  const withBills = addGroup(withIncome, "Bills", "expense");
  const incomeId = withBills.groups[0].id;
  const billsId = withBills.groups[1].id;
  const source = addRow(
    addRow(withBills, incomeId, "Salary", fixed(100000)),
    billsId,
    "Rent",
    fixed(70000),
  );
  const created = applyLeftoverCarry(source, copyBudget(source, 2026, 10));
  const leftoverRow = created.rows.find(
    (row) => row.label === "Last month leftover",
  );
  assert.ok(leftoverRow);
  assert.equal(leftoverRow.rule.kind, "fixed");
  if (leftoverRow.rule.kind === "fixed")
    assert.equal(leftoverRow.rule.amountMinor, 30000);
  const saved = addGroup(source, "Savings", "saving");
  const withHoliday = addRow(
    saved,
    saved.groups.find((group) => group.classification === "saving")!.id,
    "Holiday",
    fixed(5000),
  );
  const carried = applyLeftoverCarry(source, copyBudget(withHoliday, 2026, 10));
  const holiday = carried.rows.find((row) => row.label === "Holiday")!;
  assert.equal(holiday.rule.kind, "fixed");
  if (holiday.rule.kind === "fixed")
    assert.equal(holiday.rule.amountMinor, 35000);
  assert.equal(
    missingCurrentMonth(
      [{ id: "september", year: 2026, month: 9 }],
      new Date(2026, 8, 15),
    ),
    null,
  );
  assert.equal(
    missingCurrentMonth(
      [{ id: "september", year: 2026, month: 9 }],
      new Date(2026, 9, 2),
    )?.source?.id,
    "september",
  );
});

test("leftover can be assigned to Spending so income is fully planned", () => {
  const blank = createBlankMonth(2026, 9);
  blank.month.revision = 1;
  const withIncome = addGroup(blank, "Income", "income");
  const withBills = addGroup(withIncome, "Bills", "expense");
  const incomeId = withBills.groups[0].id;
  const billsId = withBills.groups[1].id;
  const open = addRow(
    addRow(withBills, incomeId, "Salary", fixed(100000)),
    billsId,
    "Rent",
    fixed(70000),
  );
  const first = assignLeftoverToSpending(open);
  const spending = first.rows.find((row) => row.label === "Spending");
  const spendingGroup = first.groups.find(
    (group) => group.title === "Spending",
  );
  assert.ok(spending);
  assert.equal(spending?.groupId, spendingGroup?.id);
  assert.equal(spendingGroup?.classification, "expense");
  if (spending?.rule.kind === "fixed")
    assert.equal(spending.rule.amountMinor, 30000);
  const evaluation = evaluateBudget(first);
  assert.equal(value(evaluation.leftToPlan), 0);
  assert.equal(value(evaluation.allocated), value(evaluation.income));
  assert.equal(spendingAmount(open), null);
  assert.equal(value(spendingAmount(first)!), 30000);
  assert.equal(assignLeftoverToSpending(first), first);

  const toppedUp = assignLeftoverToSpending(
    addRow(first, incomeId, "Bonus", fixed(20000)),
  );
  const updated = toppedUp.rows.find((row) => row.label === "Spending");
  if (updated?.rule.kind === "fixed")
    assert.equal(updated.rule.amountMinor, 50000);
  assert.equal(value(evaluateBudget(toppedUp).leftToPlan), 0);

  const salary = first.rows.find((row) => row.label === "Salary")!;
  const calculated = setRowRule(first, spending!.id, {
    kind: "percentage",
    rate: "10",
    source: { kind: "row", id: salary.id },
  });
  assert.throws(() => assignLeftoverToSpending(calculated), /fixed amount/);
  const locked = { ...open, month: { ...open.month, isLocked: true } };
  assert.throws(() => assignLeftoverToSpending(locked), /Unlock/);

  const released = releaseSpending(first);
  assert.equal(spendingAmount(released), null);
  assert.equal(
    released.groups.some((group) => group.title === "Spending"),
    false,
  );
  assert.equal(value(evaluateBudget(released).leftToPlan), 30000);
  assert.equal(releaseSpending(released), released);

  const inBills = addRow(open, billsId, "Spending", fixed(30000));
  const releasedBills = releaseSpending(inBills);
  assert.equal(
    releasedBills.groups.some((group) => group.id === billsId),
    true,
  );
  assert.equal(
    releasedBills.rows.some((row) => row.label === "Spending"),
    false,
  );
  assert.equal(value(evaluateBudget(releasedBills).leftToPlan), 30000);
  assert.throws(() => releaseSpending(calculated), /fixed amount/);
  const lockedSpending = {
    ...first,
    month: { ...first.month, isLocked: true },
  };
  assert.throws(() => releaseSpending(lockedSpending), /Unlock/);
});
