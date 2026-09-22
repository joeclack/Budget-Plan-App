import { assertValidBudget, evaluateBudget } from "./evaluate";
import { newId } from "./documents";
import type {
  BudgetDocument,
  BudgetGroup,
  BudgetRow,
  BudgetReference,
  Expression,
} from "./types";

export function editGroup(
  document: BudgetDocument,
  value: Pick<BudgetGroup, "title" | "classification" | "color">,
  id?: string,
): BudgetDocument {
  const draft = editable(document);
  const next = {
    title: value.title.trim(),
    classification: value.classification,
    ...(value.color ? { color: value.color } : {}),
  };
  if (id) {
    const group = draft.groups.find((item) => item.id === id);
    if (!group) throw new Error("This group no longer exists.");
    delete group.color;
    Object.assign(group, next);
  } else
    draft.groups.push({
      ...next,
      id: newId(),
      monthId: draft.month.id,
      sortOrder:
        Math.max(-1, ...draft.groups.map((item) => item.sortOrder)) + 1,
    });
  assertValidBudget(draft);
  return draft;
}

export function editRow(
  document: BudgetDocument,
  value: Pick<
    BudgetRow,
    | "label"
    | "notes"
    | "dueDay"
    | "actualMinor"
    | "groupId"
    | "rule"
    | "allocationRole"
  >,
  id?: string,
): BudgetDocument {
  const draft = editable(document);
  const row = id ? draft.rows.find((item) => item.id === id) : undefined;
  if (id && !row) throw new Error("This row no longer exists.");
  const position =
    Math.max(
      -1,
      ...draft.rows
        .filter((item) => item.groupId === value.groupId && item.id !== id)
        .map((item) => item.sortOrder),
    ) + 1;
  const actualMinor =
    value.allocationRole === "allocation" ? (value.actualMinor ?? null) : null;
  if (row)
    Object.assign(row, value, {
      label: value.label.trim(),
      actualMinor,
      sortOrder: row.groupId === value.groupId ? row.sortOrder : position,
    });
  else
    draft.rows.push({
      ...value,
      label: value.label.trim(),
      actualMinor,
      id: newId(),
      sortOrder: position,
    });
  if (actualMinor == null) {
    const saved = row ?? draft.rows[draft.rows.length - 1];
    delete saved.actualMinor;
  }
  assertValidBudget(draft);
  return draft;
}

function editable(document: BudgetDocument): BudgetDocument {
  if (document.month.isLocked)
    throw new Error("Unlock this month before editing it.");
  return {
    ...document,
    month: { ...document.month, updatedAt: new Date().toISOString() },
    groups: document.groups.map((item) => ({ ...item })),
    rows: document.rows.map((item) => ({ ...item })),
  };
}

export type ReferenceChoice = {
  token: string;
  label: string;
  reference: BudgetReference;
};
export function referenceChoices(document: BudgetDocument): ReferenceChoice[] {
  const used = new Set<string>();
  function choice(label: string, reference: BudgetReference): ReferenceChoice {
    const base = label.replace(/[\[\]]/g, "").trim() || "Untitled";
    let token = base;
    let suffix = 2;
    while (used.has(token)) token = `${base} (${suffix++})`;
    used.add(token);
    return { token, label: token, reference };
  }
  return [
    ...document.groups.map((group) =>
      choice(`${group.title} total`, { kind: "group", id: group.id }),
    ),
    ...document.rows.map((row) =>
      choice(
        `${row.label} · ${document.groups.find((group) => group.id === row.groupId)?.title ?? "Group"}`,
        { kind: "row", id: row.id },
      ),
    ),
  ];
}

/** Small arithmetic grammar; references are chosen from the current month's stable IDs. */
export function parseExpression(
  text: string,
  choices: ReferenceChoice[],
): Expression {
  if (text.length > 4096)
    throw new Error("Keep the calculation under 4,096 characters.");
  const tokens =
    text.match(/\[[^\[\]]+\]|(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/]|\S/g) ?? [];
  if (tokens.length > 256) throw new Error("This calculation is too long.");
  let index = 0;
  function primary(depth: number): Expression {
    if (depth > 48)
      throw new Error("This calculation has too many nested brackets.");
    const token = tokens[index++];
    if (!token) throw new Error("Complete the calculation.");
    if (token === "+" || token === "-") {
      const right = primary(depth + 1);
      return token === "+"
        ? right
        : {
            kind: "binary",
            operator: "-",
            left: { kind: "literal", value: "0" },
            right,
          };
    }
    if (token === "(") {
      const value = sum(depth + 1);
      if (tokens[index++] !== ")") throw new Error("Close the bracket with ).");
      return value;
    }
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      return {
        kind: "literal",
        value: token.startsWith(".")
          ? `0${token}`
          : token.endsWith(".")
            ? `${token}0`
            : token,
      };
    }
    const reference = choices.find(
      (item) => `[${item.token}]` === token,
    )?.reference;
    if (reference) return { ...reference };
    throw new Error(
      `Unknown value “${token}”. Use a number or insert a row or group below.`,
    );
  }
  function product(depth: number): Expression {
    let left = primary(depth);
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++] as "*" | "/";
      left = { kind: "binary", operator, left, right: primary(depth) };
    }
    return left;
  }
  function sum(depth: number): Expression {
    let left = product(depth);
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++] as "+" | "-";
      left = { kind: "binary", operator, left, right: product(depth) };
    }
    return left;
  }
  const result = sum(0);
  if (index !== tokens.length)
    throw new Error(`Add an operator before “${tokens[index]}”.`);
  return result;
}

export function expressionText(
  expression: Expression,
  choices: ReferenceChoice[],
): string {
  if (expression.kind === "literal") return expression.value;
  if (expression.kind === "binary")
    return `(${expressionText(expression.left, choices)} ${expression.operator} ${expressionText(expression.right, choices)})`;
  return `[${choices.find((item) => item.reference.kind === expression.kind && item.reference.id === expression.id)?.token ?? "Missing reference"}]`;
}

export function deletionDraft(
  document: BudgetDocument,
  target: { kind: "row" | "group"; id: string },
) {
  const draft = editable(document);
  const removed = new Set(
    document.rows
      .filter((row) =>
        target.kind === "row"
          ? row.id === target.id
          : row.groupId === target.id,
      )
      .map((row) => row.id),
  );
  draft.rows = draft.rows.filter((row) => !removed.has(row.id));
  if (target.kind === "group")
    draft.groups = draft.groups.filter((group) => group.id !== target.id);
  const evaluation = evaluateBudget(draft);
  const affected = draft.rows
    .filter((row) => !evaluation.rows[row.id]?.ok)
    .map((row) => row.label);
  return { draft, affected, removedCount: removed.size };
}
