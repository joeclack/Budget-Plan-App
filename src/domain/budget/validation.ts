import { isGroupColor } from "./color";
import type {
  AmountRule,
  BudgetDocument,
  BudgetTemplate,
  Expression,
} from "./types";

export class BudgetValidationError extends Error {
  constructor(
    message: string,
    readonly code = "invalid_data",
  ) {
    super(message);
    this.name = "BudgetValidationError";
  }
}

function fail(message: string): never {
  throw new BudgetValidationError(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function string(
  value: unknown,
  label: string,
  allowEmpty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > 10000 ||
    (!allowEmpty && !value.trim())
  ) {
    fail(`${label} must be ${allowEmpty ? "text" : "non-empty text"}.`);
  }
}

function integer(
  value: unknown,
  label: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < min ||
    (value as number) > max
  ) {
    fail(`${label} is out of range.`);
  }
}

function timestamp(value: unknown, label: string) {
  string(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(`${label} must be an ISO date.`);
  }
}

export function assertDecimal(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > 80 ||
    !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)
  ) {
    fail("Use a decimal number without commas or exponent notation.");
  }
}

function reference(value: Record<string, unknown>) {
  if (value.kind !== "row" && value.kind !== "group")
    fail("Unknown reference kind.");
  string(value.id, "Reference ID");
}

function expression(value: unknown, depth = 0): asserts value is Expression {
  if (depth > 64) fail("A calculation cannot be nested more than 64 levels.");
  const item = object(value, "Expression");
  if (item.kind === "literal") assertDecimal(item.value);
  else if (item.kind === "row" || item.kind === "group") reference(item);
  else if (item.kind === "binary") {
    if (!["+", "-", "*", "/"].includes(item.operator as string))
      fail("Unknown arithmetic operator.");
    expression(item.left, depth + 1);
    expression(item.right, depth + 1);
  } else fail("Unknown expression kind.");
}

export function assertRule(value: unknown): asserts value is AmountRule {
  const item = object(value, "Amount rule");
  if (item.kind === "fixed")
    integer(item.amountMinor, "Fixed amount", -Number.MAX_SAFE_INTEGER);
  else if (item.kind === "percentage") {
    assertDecimal(item.rate);
    reference(object(item.source, "Percentage source"));
  } else if (item.kind === "groupTotal") string(item.groupId, "Total group ID");
  else if (item.kind === "expression") expression(item.expression);
  else fail("Unknown amount rule kind.");
}

export function assertCalendar(year: number, month: number) {
  integer(year, "Year", 1, 9999);
  integer(month, "Month", 1, 12);
}

export function assertBudgetShape(
  value: unknown,
): asserts value is BudgetDocument {
  const doc = object(value, "Budget");
  const month = object(doc.month, "Month");
  string(month.id, "Month ID");
  assertCalendar(month.year as number, month.month as number);
  string(month.name, "Month name");
  if (typeof month.isLocked !== "boolean")
    fail("Month lock must be a boolean.");
  timestamp(month.createdAt, "Month creation date");
  timestamp(month.updatedAt, "Month update date");
  integer(month.revision, "Month revision", 0);
  if (!Array.isArray(doc.groups) || !Array.isArray(doc.rows))
    fail("Groups and rows must be arrays.");
  if (doc.groups.length > 1000 || doc.rows.length > 10000)
    fail("Budget is too large.");
  const ids = new Set<string>([month.id]);
  const groupIds = new Set<string>();
  const uniqueId = (value: unknown, label: string) => {
    string(value, label);
    if (value.length > 200 || ids.has(value))
      fail(`${label} is duplicated or too long.`);
    ids.add(value);
    return value;
  };
  for (const value of doc.groups) {
    const group = object(value, "Group");
    groupIds.add(uniqueId(group.id, "Group ID"));
    if (group.monthId !== month.id) fail("Group belongs to another month.");
    string(group.title, "Group title");
    if (
      !["income", "expense", "saving"].includes(group.classification as string)
    )
      fail("Unknown group classification.");
    if (group.color != null && !isGroupColor(group.color))
      fail("Unknown group colour.");
    integer(group.sortOrder, "Group order", 0);
  }
  for (const value of doc.rows) {
    const row = object(value, "Row");
    uniqueId(row.id, "Row ID");
    if (!groupIds.has(row.groupId as string))
      fail("Row belongs to a missing group.");
    string(row.label, "Row label");
    string(row.notes, "Row notes", true);
    if (row.dueDay !== undefined && row.dueDay !== null)
      integer(row.dueDay, "Payment day", 1, 31);
    if (
      row.allocationRole !== "allocation" &&
      row.allocationRole !== "informational"
    )
      fail("Unknown row allocation role.");
    integer(row.sortOrder, "Row order", 0);
    assertRule(row.rule);
  }
}

/** Templates carry their own month ID, preventing links back into the source month. */
export function templateDocument(value: unknown): BudgetDocument {
  const template = object(value, "Template");
  string(template.id, "Template ID");
  string(template.name, "Template name");
  timestamp(template.createdAt, "Template creation date");
  timestamp(template.updatedAt, "Template update date");
  const structure = object(template.structure, "Template structure");
  if (structure.version !== 1) fail("Unsupported template version.");
  return {
    month: {
      id: template.id,
      year: 2000,
      month: 1,
      name: template.name,
      isLocked: false,
      createdAt: template.createdAt as string,
      updatedAt: template.updatedAt as string,
      revision: 0,
    },
    groups: structure.groups as BudgetTemplate["structure"]["groups"],
    rows: structure.rows as BudgetTemplate["structure"]["rows"],
  };
}
