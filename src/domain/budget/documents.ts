import {
  assertValidBudget,
  assertValidTemplate,
  evaluateBudget,
} from "./evaluate";
import { checkedMinor } from "./money";
import type {
  AllocationRole,
  AmountResult,
  AmountRule,
  BudgetDocument,
  BudgetReference,
  BudgetTemplate,
  Classification,
  Expression,
} from "./types";
import {
  assertCalendar,
  BudgetValidationError,
  templateDocument,
} from "./validation";

let idSequence = 0;
/** IDs are opaque, local identities; the counter also prevents same-tick collisions. */
export function newId(): string {
  idSequence += 1;
  return `${Date.now().toString(36)}-${idSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function createBlankMonth(year: number, month: number): BudgetDocument {
  assertCalendar(year, month);
  const timestamp = new Date().toISOString();
  return {
    month: {
      id: newId(),
      year,
      month,
      name: `${MONTH_NAMES[month - 1]} ${year}`,
      isLocked: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
    },
    groups: [],
    rows: [],
  };
}

function remapRule(rule: AmountRule, ids: Map<string, string>): AmountRule {
  const id = (value: string) => ids.get(value) ?? value;
  const reference = (value: BudgetReference): BudgetReference => ({
    ...value,
    id: id(value.id),
  });
  const expression = (value: Expression): Expression => {
    if (value.kind === "row" || value.kind === "group") return reference(value);
    if (value.kind === "binary")
      return {
        ...value,
        left: expression(value.left),
        right: expression(value.right),
      };
    return { ...value };
  };
  switch (rule.kind) {
    case "fixed":
      return { ...rule };
    case "percentage":
      return { ...rule, source: reference(rule.source) };
    case "groupTotal":
      return { ...rule, groupId: id(rule.groupId) };
    case "expression":
      return { ...rule, expression: expression(rule.expression) };
  }
}

function remapDocument(
  source: BudgetDocument,
  destination: BudgetDocument,
): BudgetDocument {
  const ids = new Map<string, string>([
    ...source.groups.map((group) => [group.id, newId()] as [string, string]),
    ...source.rows.map((row) => [row.id, newId()] as [string, string]),
  ]);
  destination.groups = source.groups.map((group) => ({
    ...group,
    id: ids.get(group.id)!,
    monthId: destination.month.id,
  }));
  destination.rows = source.rows.map((row) => ({
    id: ids.get(row.id)!,
    groupId: ids.get(row.groupId)!,
    label: row.label,
    notes: row.notes,
    dueDay: row.dueDay,
    rule: remapRule(row.rule, ids),
    allocationRole: row.allocationRole,
    sortOrder: row.sortOrder,
  }));
  assertValidBudget(destination);
  return destination;
}

export function copyBudget(
  source: BudgetDocument,
  year: number,
  month: number,
): BudgetDocument {
  assertValidBudget(source);
  const destination = createBlankMonth(year, month);
  if (source.month.templateId)
    destination.month.templateId = source.month.templateId;
  return remapDocument(source, destination);
}

export function createTemplate(
  source: BudgetDocument,
  name: string,
): BudgetTemplate {
  assertValidBudget(source);
  const copied = remapDocument(
    source,
    createBlankMonth(source.month.year, source.month.month),
  );
  const template: BudgetTemplate = {
    id: copied.month.id,
    name: name.trim(),
    createdAt: copied.month.createdAt,
    updatedAt: copied.month.updatedAt,
    structure: { version: 1, groups: copied.groups, rows: copied.rows },
  };
  assertValidTemplate(template);
  return template;
}

export function renameTemplate(
  template: BudgetTemplate,
  name: string,
): BudgetTemplate {
  const renamed = { ...clone(template), name: name.trim() };
  assertValidTemplate(renamed);
  return renamed;
}

export function replaceTemplateStructure(
  template: BudgetTemplate,
  source: BudgetDocument,
): BudgetTemplate {
  assertValidTemplate(template);
  assertValidBudget(source);
  const copied = remapDocument(source, templateDocument(template));
  const updated: BudgetTemplate = {
    ...clone(template),
    structure: { version: 1, groups: copied.groups, rows: copied.rows },
  };
  assertValidTemplate(updated);
  return updated;
}

export function setTemplateRowRule(
  template: BudgetTemplate,
  rowId: string,
  rule: AmountRule,
): BudgetTemplate {
  assertValidTemplate(template);
  const document = setRowRule(templateDocument(template), rowId, rule);
  const updated: BudgetTemplate = {
    ...clone(template),
    structure: { version: 1, groups: document.groups, rows: document.rows },
  };
  assertValidTemplate(updated);
  return updated;
}

export function instantiateTemplate(
  template: BudgetTemplate,
  year: number,
  month: number,
): BudgetDocument {
  assertValidTemplate(template);
  const document = copyBudget(templateDocument(template), year, month);
  document.month.templateId = template.id;
  assertValidBudget(document);
  return document;
}

export function applyTemplateToMonth(
  doc: BudgetDocument,
  template: BudgetTemplate,
): BudgetDocument {
  assertValidTemplate(template);
  return update(doc, (draft) => {
    draft.month.templateId = template.id;
    const applied = remapDocument(templateDocument(template), {
      month: draft.month,
      groups: [],
      rows: [],
    });
    draft.groups = applied.groups;
    draft.rows = applied.rows;
  });
}

export function currentMonthTemplate(
  document: BudgetDocument,
  templates: BudgetTemplate[],
) {
  return (
    templates.find((item) => item.id === document.month.templateId) ??
    (templates.length === 1 ? templates[0] : undefined)
  );
}

export function calendarPeriod(now = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isSamePeriod(
  left: { year: number; month: number },
  right: { year: number; month: number },
) {
  return left.year === right.year && left.month === right.month;
}

export function latestMonthBefore(
  months: { year: number; month: number; id: string }[],
  period: { year: number; month: number },
) {
  return [...months]
    .filter(
      (item) =>
        item.year < period.year ||
        (item.year === period.year && item.month < period.month),
    )
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];
}

export function missingCurrentMonth(
  months: { year: number; month: number; id: string }[],
  now = new Date(),
) {
  const period = calendarPeriod(now);
  if (months.some((item) => isSamePeriod(item, period))) return null;
  return { ...period, source: latestMonthBefore(months, period) };
}

export function applyLeftoverCarry(
  source: BudgetDocument,
  destination: BudgetDocument,
): BudgetDocument {
  const leftover = evaluateBudget(source).leftToPlan;
  if (!leftover.ok)
    throw new BudgetValidationError(
      leftover.error.message,
      leftover.error.code,
    );
  if (leftover.amountMinor === 0) return destination;
  const savings = destination.groups
    .filter((group) => group.classification === "saving")
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1));
  const target = destination.rows
    .filter(
      (row) =>
        row.allocationRole === "allocation" &&
        savings.some((group) => group.id === row.groupId),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1))[0];
  if (target?.rule.kind === "fixed")
    return setRowRule(destination, target.id, {
      kind: "fixed",
      amountMinor: checkedCarry(target.rule.amountMinor, leftover.amountMinor),
    });
  const withGroup = savings[0]
    ? destination
    : addGroup(destination, "Savings", "saving");
  const groupId =
    savings[0]?.id ??
    withGroup.groups.find((group) => group.classification === "saving")!.id;
  return addRow(withGroup, groupId, "Last month leftover", {
    kind: "fixed",
    amountMinor: leftover.amountMinor,
  });
}

function checkedCarry(planned: number, leftover: number) {
  return checkedMinor(BigInt(planned) + BigInt(leftover));
}

function isSpendingName(value: string) {
  return value.trim().toLowerCase() === "spending";
}

function spendingRows(doc: BudgetDocument) {
  const expenseGroupIds = new Set(
    doc.groups
      .filter((group) => group.classification === "expense")
      .map((group) => group.id),
  );
  return doc.rows.filter(
    (row) =>
      row.allocationRole === "allocation" &&
      isSpendingName(row.label) &&
      expenseGroupIds.has(row.groupId),
  );
}

/** Planned amount of the expense rows named Spending, when the month has one. */
export function spendingAmount(doc: BudgetDocument): AmountResult | null {
  const rows = spendingRows(doc);
  if (rows.length === 0) return null;
  const evaluation = evaluateBudget(doc);
  let total = 0n;
  for (const row of rows) {
    const amount = evaluation.rows[row.id];
    if (!amount?.ok) {
      return (
        amount ?? {
          ok: false,
          error: {
            code: "missing_reference",
            message: "Spending could not be calculated.",
          },
        }
      );
    }
    total += BigInt(amount.amountMinor);
  }
  try {
    return { ok: true, amountMinor: checkedMinor(total) };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "unsafe_integer",
        message:
          error instanceof Error
            ? error.message
            : "Spending could not be calculated.",
      },
    };
  }
}

/** Put this month's unplanned remainder into a fixed Spending expense so income is fully planned. */
export function assignLeftoverToSpending(doc: BudgetDocument): BudgetDocument {
  const leftover = evaluateBudget(doc).leftToPlan;
  if (!leftover.ok)
    throw new BudgetValidationError(
      leftover.error.message,
      leftover.error.code,
    );
  if (leftover.amountMinor <= 0) return doc;

  const expenseGroups = doc.groups
    .filter((group) => group.classification === "expense")
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1));
  const spendingRow = spendingRows(doc).sort(
    (a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1),
  )[0];
  if (spendingRow) {
    if (spendingRow.rule.kind !== "fixed")
      throw new BudgetValidationError(
        "Change the Spending row to a fixed amount before assigning what is left.",
      );
    return setRowRule(doc, spendingRow.id, {
      kind: "fixed",
      amountMinor: checkedCarry(
        spendingRow.rule.amountMinor,
        leftover.amountMinor,
      ),
    });
  }

  const spendingGroup = expenseGroups.find((group) =>
    isSpendingName(group.title),
  );
  const withGroup = spendingGroup ? doc : addGroup(doc, "Spending", "expense");
  const groupId =
    spendingGroup?.id ??
    withGroup.groups.find(
      (group) =>
        group.classification === "expense" && isSpendingName(group.title),
    )!.id;
  return addRow(withGroup, groupId, "Spending", {
    kind: "fixed",
    amountMinor: leftover.amountMinor,
  });
}

/** Remove the Spending allocation so its amount returns to left to plan. */
export function releaseSpending(doc: BudgetDocument): BudgetDocument {
  const rows = spendingRows(doc);
  if (rows.length === 0) return doc;
  if (rows.some((row) => row.rule.kind !== "fixed"))
    throw new BudgetValidationError(
      "Change the Spending row to a fixed amount before switching back to left to plan.",
    );

  let next = doc;
  for (const row of rows) {
    if (!next.rows.some((item) => item.id === row.id)) continue;
    next = removeRow(next, row.id);
  }
  for (const group of [...next.groups]) {
    if (
      group.classification === "expense" &&
      isSpendingName(group.title) &&
      !next.rows.some((row) => row.groupId === group.id)
    ) {
      next = removeGroup(next, group.id);
    }
  }
  return next;
}

export function setRowActual(
  doc: BudgetDocument,
  rowId: string,
  actualMinor: number | null,
): BudgetDocument {
  return update(doc, (draft) => {
    const row = rowById(draft, rowId);
    if (actualMinor == null) {
      delete row.actualMinor;
      return;
    }
    if (row.allocationRole !== "allocation")
      throw new BudgetValidationError(
        "Display-only rows cannot record an actual amount.",
      );
    row.actualMinor = actualMinor;
  });
}

export function clearMonthActuals(doc: BudgetDocument): BudgetDocument {
  return update(doc, (draft) => {
    for (const row of draft.rows) {
      delete row.actualMinor;
    }
  });
}

function update(
  doc: BudgetDocument,
  action: (draft: BudgetDocument) => void,
): BudgetDocument {
  assertValidBudget(doc);
  if (doc.month.isLocked)
    throw new BudgetValidationError(
      "Unlock this month before editing it.",
      "locked",
    );
  const draft = clone(doc);
  action(draft);
  // A repository save increments revision after checking this original revision.
  draft.month.updatedAt = new Date().toISOString();
  assertValidBudget(draft);
  return draft;
}

function groupById(doc: BudgetDocument, id: string) {
  const group = doc.groups.find((item) => item.id === id);
  if (!group)
    throw new BudgetValidationError(
      "Group does not exist.",
      "missing_reference",
    );
  return group;
}
function rowById(doc: BudgetDocument, id: string) {
  const row = doc.rows.find((item) => item.id === id);
  if (!row)
    throw new BudgetValidationError("Row does not exist.", "missing_reference");
  return row;
}
function validateOrder(actual: string[], proposed: string[]) {
  if (
    actual.length !== proposed.length ||
    new Set(proposed).size !== proposed.length ||
    proposed.some((id) => !actual.includes(id))
  ) {
    throw new BudgetValidationError(
      "A reorder must contain each existing item exactly once.",
    );
  }
}

export function renameGroup(
  doc: BudgetDocument,
  groupId: string,
  title: string,
): BudgetDocument {
  return update(doc, (draft) => {
    groupById(draft, groupId).title = title.trim();
  });
}
export function renameRow(
  doc: BudgetDocument,
  rowId: string,
  label: string,
): BudgetDocument {
  return update(doc, (draft) => {
    rowById(draft, rowId).label = label.trim();
  });
}
export function setRowRule(
  doc: BudgetDocument,
  rowId: string,
  rule: AmountRule,
): BudgetDocument {
  return update(doc, (draft) => {
    rowById(draft, rowId).rule = clone(rule);
  });
}
export function addGroup(
  doc: BudgetDocument,
  title: string,
  classification: Classification = "expense",
): BudgetDocument {
  return update(doc, (draft) => {
    draft.groups.push({
      id: newId(),
      monthId: draft.month.id,
      title: title.trim(),
      classification,
      sortOrder:
        Math.max(-1, ...draft.groups.map((group) => group.sortOrder)) + 1,
    });
  });
}
export function addRow(
  doc: BudgetDocument,
  groupId: string,
  label: string,
  rule: AmountRule,
  allocationRole: AllocationRole = "allocation",
): BudgetDocument {
  return update(doc, (draft) => {
    groupById(draft, groupId);
    draft.rows.push({
      id: newId(),
      groupId,
      label: label.trim(),
      notes: "",
      dueDay: null,
      rule: clone(rule),
      allocationRole,
      sortOrder:
        Math.max(
          -1,
          ...draft.rows
            .filter((row) => row.groupId === groupId)
            .map((row) => row.sortOrder),
        ) + 1,
    });
  });
}
export function reorderGroups(
  doc: BudgetDocument,
  orderedIds: string[],
): BudgetDocument {
  return update(doc, (draft) => {
    validateOrder(
      draft.groups.map((group) => group.id),
      orderedIds,
    );
    draft.groups = orderedIds.map((id, sortOrder) => ({
      ...groupById(draft, id),
      sortOrder,
    }));
  });
}
export function reorderRows(
  doc: BudgetDocument,
  groupId: string,
  orderedIds: string[],
): BudgetDocument {
  return update(doc, (draft) => {
    groupById(draft, groupId);
    validateOrder(
      draft.rows.filter((row) => row.groupId === groupId).map((row) => row.id),
      orderedIds,
    );
    draft.rows = draft.rows.map((row) =>
      row.groupId === groupId
        ? { ...row, sortOrder: orderedIds.indexOf(row.id) }
        : row,
    );
  });
}
export function moveRow(
  doc: BudgetDocument,
  rowId: string,
  targetGroupId: string,
  index?: number,
): BudgetDocument {
  return update(doc, (draft) => {
    groupById(draft, targetGroupId);
    const row = rowById(draft, rowId);
    const originalGroupId = row.groupId;
    const destination = draft.rows
      .filter((item) => item.groupId === targetGroupId && item.id !== rowId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const position = index ?? destination.length;
    if (
      !Number.isInteger(position) ||
      position < 0 ||
      position > destination.length
    )
      throw new BudgetValidationError("Invalid destination position.");
    row.groupId = targetGroupId;
    destination.splice(position, 0, row);
    destination.forEach((item, sortOrder) => {
      item.sortOrder = sortOrder;
    });
    if (originalGroupId !== targetGroupId) {
      draft.rows
        .filter((item) => item.groupId === originalGroupId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .forEach((item, sortOrder) => {
          item.sortOrder = sortOrder;
        });
    }
  });
}
export function removeRow(doc: BudgetDocument, rowId: string): BudgetDocument {
  return update(doc, (draft) => {
    rowById(draft, rowId);
    draft.rows = draft.rows.filter((row) => row.id !== rowId);
  });
}
export function removeGroup(
  doc: BudgetDocument,
  groupId: string,
): BudgetDocument {
  return update(doc, (draft) => {
    groupById(draft, groupId);
    draft.groups = draft.groups.filter((group) => group.id !== groupId);
    draft.rows = draft.rows.filter((row) => row.groupId !== groupId);
  });
}
