import { checkedMinor, formatMinor } from "./money";
import type {
  AmountResult,
  AmountRule,
  BudgetDocument,
  BudgetEvaluation,
  BudgetReference,
  BudgetTemplate,
  CalculationError,
  Classification,
  Expression,
} from "./types";
import {
  assertBudgetShape,
  BudgetValidationError,
  templateDocument,
} from "./validation";

type Ratio = { numerator: bigint; denominator: bigint };
const ZERO = BigInt(0);
const ONE = BigInt(1);
const HUNDRED = BigInt(100);

class CalculationFailure extends Error {
  constructor(readonly detail: CalculationError) {
    super(detail.message);
  }
}

function failure(code: string, message: string, path?: string[]): never {
  throw new CalculationFailure({ code, message, ...(path ? { path } : {}) });
}

function ratio(numerator: bigint, denominator = ONE): Ratio {
  if (denominator === ZERO)
    failure("division_by_zero", "A calculation divides by zero.");
  if (
    numerator.toString().length > 4096 ||
    denominator.toString().length > 4096
  ) {
    failure(
      "calculation_too_complex",
      "The calculation is too large to evaluate safely.",
    );
  }
  if (denominator < ZERO) {
    numerator = -numerator;
    denominator = -denominator;
  }
  let a = numerator < ZERO ? -numerator : numerator;
  let b = denominator;
  while (b !== ZERO) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return { numerator: numerator / a, denominator: denominator / a };
}

function decimal(text: string): Ratio {
  const sign = text.startsWith("-") ? -ONE : ONE;
  const [whole, fraction = ""] = text.replace(/^[+-]/, "").split(".");
  return ratio(
    sign * BigInt((whole || "0") + fraction),
    BigInt(10) ** BigInt(fraction.length),
  );
}

function calculate(operator: "+" | "-" | "*" | "/", a: Ratio, b: Ratio): Ratio {
  switch (operator) {
    case "+":
      return ratio(
        a.numerator * b.denominator + b.numerator * a.denominator,
        a.denominator * b.denominator,
      );
    case "-":
      return ratio(
        a.numerator * b.denominator - b.numerator * a.denominator,
        a.denominator * b.denominator,
      );
    case "*":
      return ratio(a.numerator * b.numerator, a.denominator * b.denominator);
    case "/":
      return ratio(a.numerator * b.denominator, a.denominator * b.numerator);
  }
}

function safeMinor(value: bigint): number {
  try {
    return checkedMinor(value);
  } catch {
    return failure("overflow", "Amount exceeds the safe money limit.");
  }
}

/** Round each calculated row once to the nearest penny; exact halves go away from zero. */
function roundPounds(value: Ratio): number {
  const scaled = value.numerator * HUNDRED;
  const magnitude = scaled < ZERO ? -scaled : scaled;
  let rounded = magnitude / value.denominator;
  if ((magnitude % value.denominator) * BigInt(2) >= value.denominator)
    rounded += ONE;
  return safeMinor(scaled < ZERO ? -rounded : rounded);
}

const success = (amountMinor: number): AmountResult => ({
  ok: true,
  amountMinor,
});
function result(action: () => number): AmountResult {
  try {
    return success(action());
  } catch (error) {
    if (error instanceof CalculationFailure)
      return { ok: false, error: error.detail };
    throw error;
  }
}
function amount(result: AmountResult): number {
  if (!result.ok) throw new CalculationFailure(result.error);
  return result.amountMinor;
}

export function evaluateBudget(doc: BudgetDocument): BudgetEvaluation {
  const rows: Record<string, AmountResult> = Object.create(null);
  const groups: Record<string, AmountResult> = Object.create(null);
  try {
    assertBudgetShape(doc);
  } catch (error) {
    const invalid: AmountResult = {
      ok: false,
      error: {
        code: "invalid_data",
        message:
          error instanceof Error ? error.message : "Invalid budget data.",
      },
    };
    for (const row of Array.isArray(doc?.rows) ? doc.rows : [])
      if (typeof row?.id === "string") rows[row.id] = invalid;
    for (const group of Array.isArray(doc?.groups) ? doc.groups : [])
      if (typeof group?.id === "string") groups[group.id] = invalid;
    return {
      rows,
      groups,
      income: invalid,
      allocated: invalid,
      leftToPlan: invalid,
      actualRows: Object.create(null),
      remainingRows: Object.create(null),
      actualGroups: Object.create(null),
      actualIncome: invalid,
      actualAllocated: invalid,
      leftUnspent: invalid,
    };
  }

  const rowsById = new Map(doc.rows.map((row) => [row.id, row]));
  const groupsById = new Map(doc.groups.map((group) => [group.id, group]));
  const members = new Map<string, string[]>();
  for (const row of doc.rows) {
    if (row.allocationRole === "allocation") {
      const ids = members.get(row.groupId) ?? [];
      ids.push(row.id);
      members.set(row.groupId, ids);
    }
  }
  const visiting = new Set<string>();
  const path: string[] = [];
  const visit = (key: string, action: () => number): AmountResult => {
    if (visiting.has(key))
      return {
        ok: false,
        error: {
          code: "cycle",
          message: "These amounts contain a circular reference.",
          path: [...path.slice(path.indexOf(key)), key],
        },
      };
    if (path.length >= 256)
      return {
        ok: false,
        error: {
          code: "calculation_too_complex",
          message: "Too many dependent amounts in one calculation.",
        },
      };
    visiting.add(key);
    path.push(key);
    try {
      return result(action);
    } finally {
      path.pop();
      visiting.delete(key);
    }
  };
  const reference = (ref: BudgetReference): Ratio =>
    ratio(
      BigInt(amount(ref.kind === "row" ? row(ref.id) : group(ref.id))),
      HUNDRED,
    );
  const expression = (item: Expression): Ratio => {
    if (item.kind === "literal") return decimal(item.value);
    if (item.kind === "row" || item.kind === "group") return reference(item);
    return calculate(
      item.operator,
      expression(item.left),
      expression(item.right),
    );
  };
  const rule = (item: AmountRule): number => {
    switch (item.kind) {
      case "fixed":
        return item.amountMinor;
      case "percentage":
        return roundPounds(
          calculate(
            "*",
            reference(item.source),
            calculate("/", decimal(item.rate), ratio(HUNDRED)),
          ),
        );
      case "groupTotal":
        return amount(group(item.groupId));
      case "expression":
        return roundPounds(expression(item.expression));
    }
  };
  const sum = (values: AmountResult[]) =>
    safeMinor(
      values.reduce((total, value) => total + BigInt(amount(value)), ZERO),
    );
  const row = (id: string): AmountResult => {
    if (rows[id]) return rows[id];
    const item = rowsById.get(id);
    if (!item)
      return {
        ok: false,
        error: {
          code: "missing_reference",
          message: `Referenced row ${id} is missing.`,
        },
      };
    return (rows[id] = visit(`row:${id}`, () => rule(item.rule)));
  };
  const group = (id: string): AmountResult => {
    if (groups[id]) return groups[id];
    if (!groupsById.has(id))
      return {
        ok: false,
        error: {
          code: "missing_reference",
          message: `Referenced group ${id} is missing.`,
        },
      };
    return (groups[id] = visit(`group:${id}`, () =>
      sum((members.get(id) ?? []).map(row)),
    ));
  };
  for (const item of doc.rows) row(item.id);
  for (const item of doc.groups) group(item.id);
  const income = result(() =>
    sum(
      doc.groups
        .filter((item) => item.classification === "income")
        .map((item) => group(item.id)),
    ),
  );
  const allocated = result(() =>
    sum(
      doc.groups
        .filter((item) => item.classification !== "income")
        .map((item) => group(item.id)),
    ),
  );
  const leftToPlan = result(() =>
    safeMinor(BigInt(amount(income)) - BigInt(amount(allocated))),
  );
  const actualRows: Record<string, AmountResult> = Object.create(null);
  const remainingRows: Record<string, AmountResult> = Object.create(null);
  const actualGroups: Record<string, AmountResult> = Object.create(null);
  for (const item of doc.rows) {
    if (item.allocationRole !== "allocation" || item.actualMinor == null)
      continue;
    actualRows[item.id] = success(item.actualMinor);
    remainingRows[item.id] = result(() =>
      safeMinor(BigInt(amount(row(item.id))) - BigInt(item.actualMinor!)),
    );
  }
  for (const item of doc.groups) {
    actualGroups[item.id] = result(() =>
      sum(
        (members.get(item.id) ?? [])
          .filter((id) => actualRows[id])
          .map((id) => actualRows[id]),
      ),
    );
  }
  const actualIncome = result(() =>
    sum(
      doc.groups
        .filter((item) => item.classification === "income")
        .map((item) => actualGroups[item.id]),
    ),
  );
  const actualAllocated = result(() =>
    sum(
      doc.groups
        .filter((item) => item.classification !== "income")
        .map((item) => actualGroups[item.id]),
    ),
  );
  const leftUnspent = result(() =>
    safeMinor(BigInt(amount(actualIncome)) - BigInt(amount(actualAllocated))),
  );
  return {
    rows,
    groups,
    income,
    allocated,
    leftToPlan,
    actualRows,
    remainingRows,
    actualGroups,
    actualIncome,
    actualAllocated,
    leftUnspent,
  };
}

export function assertValidBudget(
  value: unknown,
): asserts value is BudgetDocument {
  assertBudgetShape(value);
  const evaluated = evaluateBudget(value);
  for (const item of [
    ...Object.values(evaluated.rows),
    ...Object.values(evaluated.groups),
    evaluated.income,
    evaluated.allocated,
    evaluated.leftToPlan,
    ...Object.values(evaluated.actualRows),
    ...Object.values(evaluated.remainingRows),
    ...Object.values(evaluated.actualGroups),
    evaluated.actualIncome,
    evaluated.actualAllocated,
    evaluated.leftUnspent,
  ]) {
    if (!item.ok)
      throw new BudgetValidationError(item.error.message, item.error.code);
  }
}

export function assertValidTemplate(
  value: unknown,
): asserts value is BudgetTemplate {
  assertValidBudget(templateDocument(value));
}

export function describeRule(rule: AmountRule, doc: BudgetDocument): string {
  const reference = (ref: BudgetReference) =>
    ref.kind === "row"
      ? (doc.rows.find((row) => row.id === ref.id)?.label ?? "Missing row")
      : (doc.groups.find((group) => group.id === ref.id)?.title ??
        "Missing group");
  const expression = (value: Expression): string => {
    if (value.kind === "literal") return value.value;
    if (value.kind === "row" || value.kind === "group") return reference(value);
    return `(${expression(value.left)} ${value.operator} ${expression(value.right)})`;
  };
  switch (rule.kind) {
    case "fixed":
      return `Fixed amount · ${formatMinor(rule.amountMinor)}`;
    case "percentage":
      return `${rule.rate}% of ${reference(rule.source)}`;
    case "groupTotal":
      return `Total of ${reference({ kind: "group", id: rule.groupId })}`;
    case "expression":
      return expression(rule.expression);
  }
}

export function describeActual(
  row: { actualMinor?: number | null; allocationRole: string },
  planned: AmountResult,
  classification: Classification,
) {
  if (row.allocationRole !== "allocation" || row.actualMinor == null)
    return null;
  if (!planned.ok) return "Actual recorded";
  const remaining = planned.amountMinor - row.actualMinor;
  const verb =
    classification === "income"
      ? "Received"
      : classification === "saving"
        ? "Set aside"
        : "Spent";
  if (remaining === 0)
    return `${verb} ${formatMinor(row.actualMinor)} · on plan`;
  if (remaining > 0)
    return `${verb} ${formatMinor(row.actualMinor)} · ${formatMinor(remaining)} left`;
  return `${verb} ${formatMinor(row.actualMinor)} · ${formatMinor(-remaining)} over`;
}

export function hasRecordedActuals(evaluation: BudgetEvaluation) {
  return Object.keys(evaluation.actualRows).length > 0;
}
