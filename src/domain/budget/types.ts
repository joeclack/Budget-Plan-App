/** Money is an integer number of pence. Calendar months are 1-based. */
export type MinorUnits = number;
export type Classification = "income" | "expense" | "saving";
export type AllocationRole = "allocation" | "informational";
export type BudgetReference =
  { kind: "row"; id: string } | { kind: "group"; id: string };
/** Decimal literals represent pounds or scalar multipliers, never JavaScript. */
export type Expression =
  | { kind: "literal"; value: string }
  | BudgetReference
  | {
      kind: "binary";
      operator: "+" | "-" | "*" | "/";
      left: Expression;
      right: Expression;
    };
export type AmountRule =
  | { kind: "fixed"; amountMinor: MinorUnits }
  | { kind: "percentage"; rate: string; source: BudgetReference }
  | { kind: "groupTotal"; groupId: string }
  | { kind: "expression"; expression: Expression };
export type BudgetMonth = {
  id: string;
  year: number;
  month: number;
  name: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
export type BudgetGroup = {
  id: string;
  monthId: string;
  title: string;
  classification: Classification;
  sortOrder: number;
};
export type BudgetRow = {
  id: string;
  groupId: string;
  label: string;
  notes: string;
  rule: AmountRule;
  allocationRole: AllocationRole;
  sortOrder: number;
};
export type BudgetDocument = {
  month: BudgetMonth;
  groups: BudgetGroup[];
  rows: BudgetRow[];
};
export type BudgetTemplate = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  structure: { version: 1; groups: BudgetGroup[]; rows: BudgetRow[] };
};
export type CalculationError = {
  code: string;
  message: string;
  path?: string[];
};
export type AmountResult =
  | { ok: true; amountMinor: MinorUnits }
  | { ok: false; error: CalculationError };
export type BudgetEvaluation = {
  rows: Record<string, AmountResult>;
  groups: Record<string, AmountResult>;
  income: AmountResult;
  allocated: AmountResult;
  leftToPlan: AmountResult;
};
