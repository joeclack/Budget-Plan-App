import {
  assertValidBudget,
  assertValidTemplate,
  BudgetValidationError,
  readGroupPresentationMap,
  type BudgetDocument,
  type BudgetTemplate,
  type GroupPresentationMap,
} from "./budget";
import { calculatePay, validatePayProfile } from "./pay";
import type { PayEstimateSnapshot, PayProfile } from "./pay";

/** A portable copy of everything the app stores for one person. */
export type BudgetArchive = {
  format: "budget-plan-backup";
  version: 1;
  exportedAt: string;
  months: BudgetDocument[];
  templates: BudgetTemplate[];
  payProfile: PayProfile | null;
  paySnapshots: PayEstimateSnapshot[];
  selectedMonthId: string | null;
  groupPresentation: GroupPresentationMap;
  autoApplyRecentMonth: boolean;
};

export const MAX_BACKUP_BYTES = 5_000_000;
const MAX_MONTHS = 240;
const MAX_TEMPLATES = 200;
const MAX_SNAPSHOTS = 5_000;

function fail(message: string): never {
  throw new BudgetValidationError(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function timestamp(value: unknown, label: string) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    fail(`${label} must be an ISO date.`);
}

function assertSnapshot(
  value: unknown,
  rowIds: Set<string>,
  snapshotIds: Set<string>,
) {
  const snapshot = object(value, "Pay estimate snapshot");
  if (typeof snapshot.id !== "string" || !snapshot.id.trim())
    fail("Pay estimate snapshot is missing an identifier.");
  if (snapshotIds.has(snapshot.id))
    fail("A pay estimate snapshot identifier is duplicated.");
  snapshotIds.add(snapshot.id);
  if (
    typeof snapshot.budgetRowId !== "string" ||
    !rowIds.has(snapshot.budgetRowId)
  )
    fail("A pay estimate snapshot does not belong to a saved row.");
  try {
    validatePayProfile(snapshot.inputs as PayProfile);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid pay estimate.");
  }
  const inputs = snapshot.inputs as PayProfile;
  timestamp(snapshot.calculatedAt, "Pay estimate time");
  const expected = calculatePay(inputs, snapshot.calculatedAt as string);
  if (
    snapshot.rulesetVersion !== expected.rulesetVersion ||
    JSON.stringify(snapshot.result) !== JSON.stringify(expected)
  )
    fail("A pay estimate snapshot does not match its inputs.");
}

/** Rejects anything that is not a complete, internally consistent backup. */
export function assertBudgetArchive(value: unknown): BudgetArchive {
  const archive = object(value, "Backup");
  if (typeof archive.version === "number" && archive.version > 1)
    fail("This backup was created by a newer version of Budget Plan.");
  if (archive.format !== "budget-plan-backup" || archive.version !== 1)
    fail("This file is not a Budget Plan backup.");
  timestamp(archive.exportedAt, "Backup date");
  if (!Array.isArray(archive.months) || archive.months.length > MAX_MONTHS)
    fail("This backup contains too many months.");
  if (
    !Array.isArray(archive.templates) ||
    archive.templates.length > MAX_TEMPLATES
  )
    fail("This backup contains too many templates.");
  if (
    !Array.isArray(archive.paySnapshots) ||
    archive.paySnapshots.length > MAX_SNAPSHOTS
  )
    fail("This backup contains too many pay estimates.");

  const monthIds = new Set<string>();
  const calendars = new Set<string>();
  const groupIds = new Set<string>();
  const rowIds = new Set<string>();
  const templateIds = new Set<string>();
  const months: BudgetDocument[] = [];
  for (const month of archive.months) {
    assertValidBudget(month);
    if (month.month.revision < 1)
      fail("A saved month is missing its revision.");
    if (monthIds.has(month.month.id)) fail("A month identifier is duplicated.");
    monthIds.add(month.month.id);
    const calendar = `${month.month.year}-${month.month.month}`;
    if (calendars.has(calendar))
      fail("Two months cover the same calendar month.");
    calendars.add(calendar);
    for (const group of month.groups) {
      if (groupIds.has(group.id)) fail("A group identifier is duplicated.");
      groupIds.add(group.id);
    }
    for (const row of month.rows) {
      if (rowIds.has(row.id)) fail("A row identifier is duplicated.");
      rowIds.add(row.id);
    }
    months.push(month);
  }
  const templates: BudgetTemplate[] = [];
  for (const template of archive.templates) {
    assertValidTemplate(template);
    if (templateIds.has(template.id))
      fail("A template identifier is duplicated.");
    templateIds.add(template.id);
    templates.push(template);
  }
  let payProfile: PayProfile | null = null;
  if (archive.payProfile != null) {
    try {
      validatePayProfile(archive.payProfile as PayProfile);
    } catch (error) {
      fail(
        error instanceof Error ? error.message : "Invalid take-home settings.",
      );
    }
    payProfile = archive.payProfile as PayProfile;
  }
  const snapshotIds = new Set<string>();
  const paySnapshots: PayEstimateSnapshot[] = [];
  for (const snapshot of archive.paySnapshots) {
    assertSnapshot(snapshot, rowIds, snapshotIds);
    paySnapshots.push(snapshot as PayEstimateSnapshot);
  }
  if (
    archive.selectedMonthId !== null &&
    (typeof archive.selectedMonthId !== "string" ||
      !monthIds.has(archive.selectedMonthId))
  )
    fail("The selected month is not in this backup.");
  if (
    archive.autoApplyRecentMonth !== undefined &&
    typeof archive.autoApplyRecentMonth !== "boolean"
  )
    fail("The copy-last-month setting is invalid.");

  return {
    format: "budget-plan-backup",
    version: 1,
    exportedAt: archive.exportedAt as string,
    months,
    templates,
    payProfile,
    paySnapshots,
    selectedMonthId: archive.selectedMonthId as string | null,
    groupPresentation: readGroupPresentationMap(archive.groupPresentation),
    autoApplyRecentMonth: archive.autoApplyRecentMonth === true,
  };
}

export function parseBudgetArchive(text: string): BudgetArchive {
  if (text.length > MAX_BACKUP_BYTES) fail("This backup file is too large.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    fail("This file is not a Budget Plan backup.");
  }
  return assertBudgetArchive(value);
}

export function serializeBudgetArchive(archive: BudgetArchive): string {
  return JSON.stringify(assertBudgetArchive(archive));
}
