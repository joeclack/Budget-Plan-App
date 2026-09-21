import { assertValidBudget, assertValidTemplate } from "./evaluate";
import type {
  AllocationRole,
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
    ...row,
    id: ids.get(row.id)!,
    groupId: ids.get(row.groupId)!,
    rule: remapRule(row.rule, ids),
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
  return remapDocument(source, createBlankMonth(year, month));
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

export function instantiateTemplate(
  template: BudgetTemplate,
  year: number,
  month: number,
): BudgetDocument {
  assertValidTemplate(template);
  return copyBudget(templateDocument(template), year, month);
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
