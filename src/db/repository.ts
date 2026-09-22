import { assertBudgetArchive, type BudgetArchive } from "../domain/backup";
import { ensureTemplateIdColumn } from "./migrate";
import {
  assertValidBudget,
  assertValidTemplate,
  isGroupColor,
  readGroupPresentationMap,
  type GroupPresentationMap,
} from "../domain/budget";
import { calculatePay, validatePayProfile } from "../domain/pay";
import type {
  PayEstimate,
  PayEstimateSnapshot,
  PayProfile,
} from "../domain/pay";
import type {
  BudgetDocument,
  BudgetGroup,
  BudgetMonth,
  BudgetRow,
  BudgetTemplate,
} from "../domain/budget/types";
import {
  assertForeignKeys,
  inTransaction,
  serializeDatabase,
  type SqlConnection,
  type SqlDatabase,
} from "./sql";

export interface BudgetRepository {
  removeDemoData(): Promise<void>;
  listMonths(): Promise<BudgetMonth[]>;
  loadMonth(id: string): Promise<BudgetDocument | null>;
  findMonth(year: number, month: number): Promise<BudgetDocument | null>;
  saveMonth(
    document: BudgetDocument,
    snapshot?: PayEstimateSnapshot,
  ): Promise<BudgetDocument>;
  setMonthLocked(
    id: string,
    revision: number,
    locked: boolean,
  ): Promise<BudgetDocument>;
  setMonthTemplateId(
    id: string,
    revision: number,
    templateId: string,
  ): Promise<BudgetDocument>;
  listTemplates(): Promise<BudgetTemplate[]>;
  loadTemplate(id: string): Promise<BudgetTemplate | null>;
  saveTemplate(template: BudgetTemplate): Promise<BudgetTemplate>;
  deleteTemplate(id: string, updatedAt: string): Promise<void>;
  getPayProfile(): Promise<PayProfile | null>;
  savePayProfile(profile: PayProfile): Promise<PayProfile>;
  getSelectedMonthId(): Promise<string | null>;
  setSelectedMonthId(id: string): Promise<void>;
  getGroupPresentation(): Promise<GroupPresentationMap>;
  saveGroupPresentation(value: GroupPresentationMap): Promise<void>;
  getAutoApplyRecentMonth(): Promise<boolean>;
  setAutoApplyRecentMonth(value: boolean): Promise<void>;
  exportStore(): Promise<BudgetArchive>;
  restoreStore(archive: BudgetArchive): Promise<void>;
}

export type StorageErrorCode =
  | "CONFLICT"
  | "LOCKED"
  | "DUPLICATE_MONTH"
  | "FOREIGN_ID"
  | "INVALID_DATA"
  | "NOT_FOUND"
  | "NEWER_SCHEMA";

export class BudgetStorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BudgetStorageError";
  }
}

type MonthRecord = {
  id: string;
  year: number;
  month: number;
  name: string;
  is_locked: number;
  created_at: string;
  updated_at: string;
  revision: number;
  template_id: string | null;
};
type GroupRecord = {
  id: string;
  month_id: string;
  title: string;
  classification: BudgetGroup["classification"];
  sort_order: number;
  color: string | null;
};
type RowRecord = {
  id: string;
  group_id: string;
  label: string;
  notes: string | null;
  due_day: number | null;
  actual_minor: number | null;
  rule_json: string;
  allocation_role: BudgetRow["allocationRole"];
  sort_order: number;
};
type TemplateRecord = {
  id: string;
  name: string;
  structure_json: string;
  created_at: string;
  updated_at: string;
};
type SnapshotRecord = {
  id: string;
  budget_row_id: string;
  inputs_json: string;
  result_json: string;
  ruleset_version: string;
  calculated_at: string;
};
type PayProfileRecord = {
  id: "primary";
  annual_salary_minor: number;
  pension_rate_bps: number;
  employer_pension_rate_bps?: number;
  pension_method: PayProfile["pensionMethod"];
  pension_basis: "whole_salary";
  country: PayProfile["country"];
  tax_year: PayProfile["taxYear"];
  updated_at: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function assertSnapshot(snapshot: PayEstimateSnapshot) {
  if (!snapshot.id?.trim() || !snapshot.budgetRowId?.trim())
    throw new BudgetStorageError(
      "INVALID_DATA",
      "Invalid pay estimate snapshot.",
    );
  validatePayProfile(snapshot.inputs);
  const expected = calculatePay(snapshot.inputs, snapshot.calculatedAt);
  if (
    snapshot.rulesetVersion !== expected.rulesetVersion ||
    JSON.stringify(snapshot.result) !== JSON.stringify(expected)
  )
    throw new BudgetStorageError(
      "INVALID_DATA",
      "The pay estimate snapshot does not match its inputs.",
    );
}
function assertId(id: string) {
  if (typeof id !== "string" || id.trim().length === 0)
    throw new BudgetStorageError("INVALID_DATA", "An identifier is required.");
}
function assertCalendar(year: number, month: number) {
  if (
    !Number.isSafeInteger(year) ||
    year < 1 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new BudgetStorageError(
      "INVALID_DATA",
      "Choose a valid calendar month.",
    );
  }
}
function decodeMonth(row: MonthRecord): BudgetMonth {
  const month = {
    id: row.id,
    year: row.year,
    month: row.month,
    name: row.name,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
    ...(row.template_id ? { templateId: row.template_id } : {}),
  };
  assertValidBudget({ month, groups: [], rows: [] });
  return month;
}
function decodeTemplate(row: TemplateRecord): BudgetTemplate {
  const template: BudgetTemplate = {
    id: row.id,
    name: row.name,
    structure: JSON.parse(row.structure_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  assertValidTemplate(template);
  return template;
}
async function readMonth(
  transaction: SqlConnection,
  id: string,
): Promise<BudgetDocument | null> {
  const month = await transaction.getFirstAsync<MonthRecord>(
    "SELECT * FROM budget_months WHERE id = ?",
    id,
  );
  if (!month) return null;
  const groups = await transaction.getAllAsync<GroupRecord>(
    "SELECT * FROM budget_groups WHERE month_id = ? ORDER BY sort_order, id",
    id,
  );
  const rows = await transaction.getAllAsync<RowRecord>(
    "SELECT r.* FROM budget_rows r JOIN budget_groups g ON g.id = r.group_id WHERE g.month_id = ? ORDER BY g.sort_order, g.id, r.sort_order, r.id",
    id,
  );
  const document: BudgetDocument = {
    month: decodeMonth(month),
    groups: groups.map((group) => ({
      id: group.id,
      monthId: group.month_id,
      title: group.title,
      classification: group.classification,
      sortOrder: group.sort_order,
      ...(isGroupColor(group.color) ? { color: group.color } : {}),
    })),
    rows: rows.map((row) => ({
      id: row.id,
      groupId: row.group_id,
      label: row.label,
      notes: row.notes ?? "",
      dueDay: row.due_day,
      actualMinor: row.actual_minor,
      rule: JSON.parse(row.rule_json),
      allocationRole: row.allocation_role,
      sortOrder: row.sort_order,
    })),
  };
  assertValidBudget(document);
  return document;
}

function decodePayProfile(row: PayProfileRecord): PayProfile {
  const profile: PayProfile = {
    id: row.id,
    annualSalaryMinor: row.annual_salary_minor,
    pensionRateBps: row.pension_rate_bps,
    employerPensionRateBps: row.employer_pension_rate_bps ?? 0,
    pensionMethod: row.pension_method,
    pensionBasis: row.pension_basis,
    country: row.country,
    taxYear: row.tax_year,
    updatedAt: row.updated_at,
  };
  validatePayProfile(profile);
  return profile;
}

async function readArchive(connection: SqlConnection): Promise<BudgetArchive> {
  const monthRows = await connection.getAllAsync<{ id: string }>(
    "SELECT id FROM budget_months ORDER BY year, month, id",
  );
  const months: BudgetDocument[] = [];
  for (const row of monthRows) {
    const document = await readMonth(connection, row.id);
    if (document) months.push(document);
  }
  const templates = (
    await connection.getAllAsync<TemplateRecord>(
      "SELECT * FROM budget_templates ORDER BY name COLLATE NOCASE, id",
    )
  ).map(decodeTemplate);
  const profile = await connection.getFirstAsync<PayProfileRecord>(
    "SELECT * FROM pay_profiles WHERE id = 'primary'",
  );
  const snapshots = (
    await connection.getAllAsync<SnapshotRecord>(
      "SELECT * FROM pay_estimate_snapshots WHERE budget_row_id IS NOT NULL ORDER BY calculated_at, id",
    )
  ).map((row) => {
    let inputs: PayProfile;
    let result: PayEstimate;
    try {
      inputs = JSON.parse(row.inputs_json) as PayProfile;
      result = JSON.parse(row.result_json) as PayEstimate;
    } catch {
      throw new BudgetStorageError(
        "INVALID_DATA",
        "A saved pay estimate could not be read.",
      );
    }
    return {
      id: row.id,
      budgetRowId: row.budget_row_id,
      inputs,
      result,
      rulesetVersion: row.ruleset_version,
      calculatedAt: row.calculated_at,
    } satisfies PayEstimateSnapshot;
  });
  const selection = await connection.getFirstAsync<{ value_json: string }>(
    "SELECT value_json FROM app_settings WHERE key = 'selectedMonthId'",
  );
  let selectedMonthId: string | null = null;
  if (selection) {
    try {
      const id = JSON.parse(selection.value_json) as unknown;
      if (typeof id === "string" && months.some((item) => item.month.id === id))
        selectedMonthId = id;
    } catch {
      selectedMonthId = null;
    }
  }
  const presentation = await connection.getFirstAsync<{ value_json: string }>(
    "SELECT value_json FROM app_settings WHERE key = 'groupPresentation'",
  );
  let groupPresentation: GroupPresentationMap = {};
  if (presentation) {
    try {
      groupPresentation = readGroupPresentationMap(
        JSON.parse(presentation.value_json),
      );
    } catch {
      groupPresentation = {};
    }
  }
  return {
    format: "budget-plan-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    months,
    templates,
    payProfile: profile ? decodePayProfile(profile) : null,
    paySnapshots: snapshots,
    selectedMonthId,
    groupPresentation,
    autoApplyRecentMonth: await readBooleanSetting(
      connection,
      "autoApplyRecentMonth",
    ),
  };
}

async function readBooleanSetting(connection: SqlConnection, key: string) {
  const setting = await connection.getFirstAsync<{ value_json: string }>(
    "SELECT value_json FROM app_settings WHERE key = ?",
    key,
  );
  if (!setting) return false;
  try {
    return JSON.parse(setting.value_json) === true;
  } catch {
    return false;
  }
}

/** Every multi-query operation uses its own transaction connection and stable snapshot. */
export function createBudgetRepository(db: SqlDatabase): BudgetRepository {
  let schemaReady = false;
  const transaction = <T>(task: (connection: SqlConnection) => Promise<T>) =>
    serializeDatabase(db, () =>
      inTransaction(db, async (connection) => {
        if (!schemaReady) {
          await ensureTemplateIdColumn(connection);
          schemaReady = true;
        }
        return task(connection);
      }),
    );
  return {
    removeDemoData: () =>
      transaction(async (connection) => {
        const demoRows = await connection.getAllAsync<{ id: string }>(
          "SELECT id FROM budget_months WHERE name = 'Example budget'",
        );
        if (!demoRows.length) return;
        const selection = await connection.getFirstAsync<{
          value_json: string;
        }>("SELECT value_json FROM app_settings WHERE key = 'selectedMonthId'");
        await connection.runAsync(`UPDATE pay_estimate_snapshots
          SET budget_row_id = NULL
          WHERE budget_row_id IN (
            SELECT r.id FROM budget_rows r
            JOIN budget_groups g ON g.id = r.group_id
            JOIN budget_months m ON m.id = g.month_id
            WHERE m.name = 'Example budget'
          )`);
        await connection.runAsync(`DELETE FROM budget_rows WHERE group_id IN (
          SELECT g.id FROM budget_groups g
          JOIN budget_months m ON m.id = g.month_id
          WHERE m.name = 'Example budget'
        )`);
        await connection.runAsync(`DELETE FROM budget_groups WHERE month_id IN (
          SELECT id FROM budget_months WHERE name = 'Example budget'
        )`);
        await connection.runAsync(
          "DELETE FROM budget_months WHERE name = 'Example budget'",
        );
        if (
          selection &&
          demoRows.some(
            (row) => selection.value_json === JSON.stringify(row.id),
          )
        )
          await connection.runAsync(
            "DELETE FROM app_settings WHERE key = 'selectedMonthId'",
          );
        await assertForeignKeys(connection);
      }),
    listMonths: () =>
      transaction(async (connection) => {
        const months = await connection.getAllAsync<MonthRecord>(
          "SELECT * FROM budget_months ORDER BY year DESC, month DESC, id",
        );
        return months.map(decodeMonth);
      }),
    async loadMonth(id) {
      assertId(id);
      return transaction((connection) => readMonth(connection, id));
    },
    async findMonth(year, month) {
      assertCalendar(year, month);
      return transaction(async (connection) => {
        const record = await connection.getFirstAsync<{ id: string }>(
          "SELECT id FROM budget_months WHERE year = ? AND month = ?",
          year,
          month,
        );
        return record ? readMonth(connection, record.id) : null;
      });
    },
    async saveMonth(input, inputSnapshot) {
      assertValidBudget(input);
      if (inputSnapshot) assertSnapshot(inputSnapshot);
      if (input.month.revision === Number.MAX_SAFE_INTEGER)
        throw new BudgetStorageError(
          "INVALID_DATA",
          "This month's revision limit has been reached.",
        );
      // Capture before queueing: changing a caller's draft cannot change an in-flight save.
      const document = clone(input);
      const snapshot = inputSnapshot ? clone(inputSnapshot) : undefined;
      return transaction(async (connection) => {
        const month = document.month;
        const existing = await connection.getFirstAsync<MonthRecord>(
          "SELECT * FROM budget_months WHERE id = ?",
          month.id,
        );
        if (existing?.is_locked)
          throw new BudgetStorageError("LOCKED", "This month is locked.");
        if (
          (existing && existing.revision !== month.revision) ||
          (!existing && month.revision !== 0)
        ) {
          throw new BudgetStorageError(
            "CONFLICT",
            "This month has changed. Reload it before saving again.",
          );
        }
        if (existing && existing.created_at !== month.createdAt)
          throw new BudgetStorageError(
            "INVALID_DATA",
            "A saved month's creation date cannot change.",
          );
        const duplicate = await connection.getFirstAsync<{ id: string }>(
          "SELECT id FROM budget_months WHERE year = ? AND month = ? AND id <> ?",
          month.year,
          month.month,
          month.id,
        );
        if (duplicate)
          throw new BudgetStorageError(
            "DUPLICATE_MONTH",
            "A budget already exists for that month.",
          );
        for (const group of document.groups) {
          const owner = await connection.getFirstAsync<{ month_id: string }>(
            "SELECT month_id FROM budget_groups WHERE id = ?",
            group.id,
          );
          if (owner && owner.month_id !== month.id)
            throw new BudgetStorageError(
              "FOREIGN_ID",
              "A group belongs to another month. Copy it with a new identifier.",
            );
        }
        for (const row of document.rows) {
          const owner = await connection.getFirstAsync<{ month_id: string }>(
            "SELECT g.month_id FROM budget_rows r JOIN budget_groups g ON g.id = r.group_id WHERE r.id = ?",
            row.id,
          );
          if (owner && owner.month_id !== month.id)
            throw new BudgetStorageError(
              "FOREIGN_ID",
              "A row belongs to another month. Copy it with a new identifier.",
            );
        }
        if (
          snapshot &&
          !document.rows.some((row) => row.id === snapshot.budgetRowId)
        )
          throw new BudgetStorageError(
            "INVALID_DATA",
            "The salary row does not belong to this month.",
          );
        const previousRows = await connection.getAllAsync<{ id: string }>(
          "SELECT r.id FROM budget_rows r JOIN budget_groups g ON g.id = r.group_id WHERE g.month_id = ?",
          month.id,
        );
        const previousGroups = await connection.getAllAsync<{ id: string }>(
          "SELECT id FROM budget_groups WHERE month_id = ?",
          month.id,
        );
        month.revision = (existing?.revision ?? 0) + 1;
        month.updatedAt = new Date().toISOString();
        if (existing) {
          const result = await connection.runAsync(
            "UPDATE budget_months SET year = ?, month = ?, name = ?, is_locked = ?, updated_at = ?, revision = ?, template_id = ? WHERE id = ? AND revision = ?",
            month.year,
            month.month,
            month.name,
            Number(month.isLocked),
            month.updatedAt,
            month.revision,
            month.templateId ?? null,
            month.id,
            existing.revision,
          );
          if (result.changes !== 1)
            throw new BudgetStorageError(
              "CONFLICT",
              "This month has changed. Reload it before saving again.",
            );
        } else {
          await connection.runAsync(
            "INSERT INTO budget_months (id, year, month, name, is_locked, created_at, updated_at, revision, template_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            month.id,
            month.year,
            month.month,
            month.name,
            Number(month.isLocked),
            month.createdAt,
            month.updatedAt,
            month.revision,
            month.templateId ?? null,
          );
        }
        // Upsert retained identities instead of replacing: linked pay snapshots survive edits.
        for (const group of document.groups) {
          await connection.runAsync(
            "INSERT INTO budget_groups (id, month_id, title, classification, sort_order, color) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, classification = excluded.classification, sort_order = excluded.sort_order, color = excluded.color",
            group.id,
            group.monthId,
            group.title,
            group.classification,
            group.sortOrder,
            group.color ?? null,
          );
        }
        for (const row of document.rows) {
          await connection.runAsync(
            "INSERT INTO budget_rows (id, group_id, label, notes, due_day, actual_minor, rule_json, allocation_role, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET group_id = excluded.group_id, label = excluded.label, notes = excluded.notes, due_day = excluded.due_day, actual_minor = excluded.actual_minor, rule_json = excluded.rule_json, allocation_role = excluded.allocation_role, sort_order = excluded.sort_order",
            row.id,
            row.groupId,
            row.label,
            row.notes,
            row.dueDay ?? null,
            row.actualMinor ?? null,
            JSON.stringify(row.rule),
            row.allocationRole,
            row.sortOrder,
          );
        }
        if (snapshot)
          await connection.runAsync(
            "INSERT INTO pay_estimate_snapshots (id, budget_row_id, inputs_json, result_json, ruleset_version, calculated_at) VALUES (?, ?, ?, ?, ?, ?)",
            snapshot.id,
            snapshot.budgetRowId,
            JSON.stringify(snapshot.inputs),
            JSON.stringify(snapshot.result),
            snapshot.rulesetVersion,
            snapshot.calculatedAt,
          );
        const retainedRows = new Set(document.rows.map((row) => row.id));
        for (const row of previousRows) {
          if (retainedRows.has(row.id)) continue;
          // The transaction's connection may not inherit foreign_keys=ON from Expo's provider.
          await connection.runAsync(
            "UPDATE pay_estimate_snapshots SET budget_row_id = NULL WHERE budget_row_id = ?",
            row.id,
          );
          await connection.runAsync(
            "DELETE FROM budget_rows WHERE id = ?",
            row.id,
          );
        }
        const retainedGroups = new Set(
          document.groups.map((group) => group.id),
        );
        for (const group of previousGroups) {
          if (!retainedGroups.has(group.id))
            await connection.runAsync(
              "DELETE FROM budget_groups WHERE id = ? AND month_id = ?",
              group.id,
              month.id,
            );
        }
        await assertForeignKeys(connection);
        return (await readMonth(connection, month.id))!;
      });
    },
    async setMonthLocked(id, revision, locked) {
      assertId(id);
      if (
        !Number.isSafeInteger(revision) ||
        revision < 1 ||
        revision >= Number.MAX_SAFE_INTEGER ||
        typeof locked !== "boolean"
      )
        throw new BudgetStorageError(
          "INVALID_DATA",
          "Invalid month lock request.",
        );
      return transaction(async (connection) => {
        const existing = await readMonth(connection, id);
        if (!existing)
          throw new BudgetStorageError(
            "NOT_FOUND",
            "This month no longer exists.",
          );
        if (existing.month.revision !== revision)
          throw new BudgetStorageError(
            "CONFLICT",
            "This month has changed. Reload it before changing its lock.",
          );
        const result = await connection.runAsync(
          "UPDATE budget_months SET is_locked = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ?",
          Number(locked),
          revision + 1,
          new Date().toISOString(),
          id,
          revision,
        );
        if (result.changes !== 1)
          throw new BudgetStorageError(
            "CONFLICT",
            "This month has changed. Reload it first.",
          );
        return (await readMonth(connection, id))!;
      });
    },
    async setMonthTemplateId(id, revision, templateId) {
      assertId(id);
      assertId(templateId);
      if (
        !Number.isSafeInteger(revision) ||
        revision < 1 ||
        revision >= Number.MAX_SAFE_INTEGER
      )
        throw new BudgetStorageError(
          "INVALID_DATA",
          "Invalid month template request.",
        );
      return transaction(async (connection) => {
        const existing = await readMonth(connection, id);
        if (!existing)
          throw new BudgetStorageError(
            "NOT_FOUND",
            "This month no longer exists.",
          );
        if (existing.month.revision !== revision)
          throw new BudgetStorageError(
            "CONFLICT",
            "This month has changed. Reload it before changing its template.",
          );
        const template = await connection.getFirstAsync<{ id: string }>(
          "SELECT id FROM budget_templates WHERE id = ?",
          templateId,
        );
        if (!template)
          throw new BudgetStorageError(
            "NOT_FOUND",
            "The template could not be found.",
          );
        const result = await connection.runAsync(
          "UPDATE budget_months SET template_id = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ?",
          templateId,
          revision + 1,
          new Date().toISOString(),
          id,
          revision,
        );
        if (result.changes !== 1)
          throw new BudgetStorageError(
            "CONFLICT",
            "This month has changed. Reload it first.",
          );
        return (await readMonth(connection, id))!;
      });
    },
    listTemplates: () =>
      transaction(async (connection) => {
        const records = await connection.getAllAsync<TemplateRecord>(
          "SELECT * FROM budget_templates ORDER BY name COLLATE NOCASE, id",
        );
        return records.map(decodeTemplate);
      }),
    async loadTemplate(id) {
      assertId(id);
      return transaction(async (connection) => {
        const record = await connection.getFirstAsync<TemplateRecord>(
          "SELECT * FROM budget_templates WHERE id = ?",
          id,
        );
        return record ? decodeTemplate(record) : null;
      });
    },
    async saveTemplate(input) {
      assertValidTemplate(input);
      const template = clone(input);
      return transaction(async (connection) => {
        const existing = await connection.getFirstAsync<TemplateRecord>(
          "SELECT * FROM budget_templates WHERE id = ?",
          template.id,
        );
        if (
          existing &&
          (existing.updated_at !== template.updatedAt ||
            existing.created_at !== template.createdAt)
        )
          throw new BudgetStorageError(
            "CONFLICT",
            "This template has changed. Reload it before saving again.",
          );
        // Guarantee an advancing token even for consecutive writes in one millisecond.
        template.updatedAt = new Date(
          Math.max(
            Date.now(),
            existing ? Date.parse(existing.updated_at) + 1 : 0,
          ),
        ).toISOString();
        await connection.runAsync(
          "INSERT INTO budget_templates (id, name, structure_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, structure_json = excluded.structure_json, updated_at = excluded.updated_at",
          template.id,
          template.name,
          JSON.stringify(template.structure),
          template.createdAt,
          template.updatedAt,
        );
        return template;
      });
    },
    async deleteTemplate(id, updatedAt) {
      assertId(id);
      if (!Number.isFinite(Date.parse(updatedAt)))
        throw new BudgetStorageError(
          "INVALID_DATA",
          "The template version is invalid.",
        );
      return transaction(async (connection) => {
        const existing = await connection.getFirstAsync<TemplateRecord>(
          "SELECT * FROM budget_templates WHERE id = ?",
          id,
        );
        if (!existing)
          throw new BudgetStorageError(
            "NOT_FOUND",
            "This template no longer exists.",
          );
        if (existing.updated_at !== updatedAt)
          throw new BudgetStorageError(
            "CONFLICT",
            "This template has changed. Reload it before deleting it.",
          );
        await connection.runAsync(
          "DELETE FROM budget_templates WHERE id = ? AND updated_at = ?",
          id,
          updatedAt,
        );
        await connection.runAsync(
          "UPDATE budget_months SET template_id = NULL WHERE template_id = ?",
          id,
        );
      });
    },
    getPayProfile: () =>
      transaction(async (connection) => {
        const row = await connection.getFirstAsync<PayProfileRecord>(
          "SELECT * FROM pay_profiles WHERE id = 'primary'",
        );
        if (!row) return null;
        return decodePayProfile(row);
      }),
    async savePayProfile(input) {
      validatePayProfile(input);
      const profile = clone(input);
      profile.updatedAt = new Date().toISOString();
      return transaction(async (connection) => {
        await connection.runAsync(
          "INSERT INTO pay_profiles (id, annual_salary_minor, pension_rate_bps, employer_pension_rate_bps, pension_method, pension_basis, country, tax_year, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET annual_salary_minor = excluded.annual_salary_minor, pension_rate_bps = excluded.pension_rate_bps, employer_pension_rate_bps = excluded.employer_pension_rate_bps, pension_method = excluded.pension_method, pension_basis = excluded.pension_basis, country = excluded.country, tax_year = excluded.tax_year, updated_at = excluded.updated_at",
          profile.id,
          profile.annualSalaryMinor,
          profile.pensionRateBps,
          profile.employerPensionRateBps ?? 0,
          profile.pensionMethod,
          profile.pensionBasis,
          profile.country,
          profile.taxYear,
          profile.updatedAt,
        );
        return profile;
      });
    },
    getSelectedMonthId: () =>
      transaction(async (connection) => {
        const setting = await connection.getFirstAsync<{ value_json: string }>(
          "SELECT value_json FROM app_settings WHERE key = 'selectedMonthId'",
        );
        if (!setting) return null;
        let id: unknown;
        try {
          id = JSON.parse(setting.value_json);
        } catch {
          return null;
        }
        if (typeof id !== "string") return null;
        const month = await connection.getFirstAsync<{ id: string }>(
          "SELECT id FROM budget_months WHERE id = ?",
          id,
        );
        return month?.id ?? null;
      }),
    async setSelectedMonthId(id) {
      assertId(id);
      return transaction(async (connection) => {
        const month = await connection.getFirstAsync<{ id: string }>(
          "SELECT id FROM budget_months WHERE id = ?",
          id,
        );
        if (!month)
          throw new BudgetStorageError(
            "NOT_FOUND",
            "Save the month before selecting it.",
          );
        await connection.runAsync(
          "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('selectedMonthId', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
          JSON.stringify(id),
          new Date().toISOString(),
        );
      });
    },
    getGroupPresentation: () =>
      transaction(async (connection) => {
        const setting = await connection.getFirstAsync<{
          value_json: string;
        }>(
          "SELECT value_json FROM app_settings WHERE key = 'groupPresentation'",
        );
        if (!setting) return {};
        try {
          return readGroupPresentationMap(JSON.parse(setting.value_json));
        } catch {
          return {};
        }
      }),
    saveGroupPresentation: (value) =>
      transaction(async (connection) => {
        await connection.runAsync(
          "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('groupPresentation', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
          JSON.stringify(readGroupPresentationMap(value)),
          new Date().toISOString(),
        );
      }),
    getAutoApplyRecentMonth: () =>
      transaction((connection) =>
        readBooleanSetting(connection, "autoApplyRecentMonth"),
      ),
    setAutoApplyRecentMonth: (value) =>
      transaction(async (connection) => {
        await connection.runAsync(
          "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('autoApplyRecentMonth', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
          JSON.stringify(value === true),
          new Date().toISOString(),
        );
      }),
    exportStore: () =>
      transaction(async (connection) =>
        assertBudgetArchive(await readArchive(connection)),
      ),
    async restoreStore(input) {
      const archive = assertBudgetArchive(clone(input));
      await transaction(async (connection) => {
        await connection.execAsync(`
          DELETE FROM pay_estimate_snapshots;
          DELETE FROM budget_rows;
          DELETE FROM budget_groups;
          DELETE FROM budget_months;
          DELETE FROM budget_templates;
          DELETE FROM pay_profiles;
          DELETE FROM app_settings WHERE key IN ('selectedMonthId', 'groupPresentation', 'autoApplyRecentMonth');
        `);
        for (const document of archive.months) {
          const month = document.month;
          await connection.runAsync(
            "INSERT INTO budget_months (id, year, month, name, is_locked, created_at, updated_at, revision, template_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            month.id,
            month.year,
            month.month,
            month.name,
            month.isLocked ? 1 : 0,
            month.createdAt,
            month.updatedAt,
            month.revision,
            month.templateId ?? null,
          );
          for (const group of document.groups)
            await connection.runAsync(
              "INSERT INTO budget_groups (id, month_id, title, classification, sort_order, color) VALUES (?, ?, ?, ?, ?, ?)",
              group.id,
              group.monthId,
              group.title,
              group.classification,
              group.sortOrder,
              group.color ?? null,
            );
          for (const row of document.rows)
            await connection.runAsync(
              "INSERT INTO budget_rows (id, group_id, label, notes, due_day, actual_minor, rule_json, allocation_role, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              row.id,
              row.groupId,
              row.label,
              row.notes,
              row.dueDay ?? null,
              row.actualMinor ?? null,
              JSON.stringify(row.rule),
              row.allocationRole,
              row.sortOrder,
            );
        }
        for (const template of archive.templates)
          await connection.runAsync(
            "INSERT INTO budget_templates (id, name, structure_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            template.id,
            template.name,
            JSON.stringify(template.structure),
            template.createdAt,
            template.updatedAt,
          );
        if (archive.payProfile)
          await connection.runAsync(
            "INSERT INTO pay_profiles (id, annual_salary_minor, pension_rate_bps, employer_pension_rate_bps, pension_method, pension_basis, country, tax_year, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            archive.payProfile.id,
            archive.payProfile.annualSalaryMinor,
            archive.payProfile.pensionRateBps,
            archive.payProfile.employerPensionRateBps ?? 0,
            archive.payProfile.pensionMethod,
            archive.payProfile.pensionBasis,
            archive.payProfile.country,
            archive.payProfile.taxYear,
            archive.payProfile.updatedAt,
          );
        for (const snapshot of archive.paySnapshots)
          await connection.runAsync(
            "INSERT INTO pay_estimate_snapshots (id, budget_row_id, inputs_json, result_json, ruleset_version, calculated_at) VALUES (?, ?, ?, ?, ?, ?)",
            snapshot.id,
            snapshot.budgetRowId,
            JSON.stringify(snapshot.inputs),
            JSON.stringify(snapshot.result),
            snapshot.rulesetVersion,
            snapshot.calculatedAt,
          );
        const savedAt = archive.exportedAt;
        if (archive.selectedMonthId)
          await connection.runAsync(
            "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('selectedMonthId', ?, ?)",
            JSON.stringify(archive.selectedMonthId),
            savedAt,
          );
        await connection.runAsync(
          "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('groupPresentation', ?, ?)",
          JSON.stringify(archive.groupPresentation),
          savedAt,
        );
        await connection.runAsync(
          "INSERT INTO app_settings (key, value_json, updated_at) VALUES ('autoApplyRecentMonth', ?, ?)",
          JSON.stringify(archive.autoApplyRecentMonth),
          savedAt,
        );
        await assertForeignKeys(connection);
      });
    },
  };
}
