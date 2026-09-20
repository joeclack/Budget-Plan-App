import type { SQLiteDatabase } from "expo-sqlite";

const DATABASE_VERSION = 1;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const result = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE budget_months (
        id TEXT PRIMARY KEY NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        name TEXT NOT NULL,
        is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (year, month)
      );

      CREATE TABLE budget_groups (
        id TEXT PRIMARY KEY NOT NULL,
        month_id TEXT NOT NULL REFERENCES budget_months(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        classification TEXT NOT NULL CHECK (classification IN ('income', 'expense', 'saving')),
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE budget_rows (
        id TEXT PRIMARY KEY NOT NULL,
        group_id TEXT NOT NULL REFERENCES budget_groups(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        notes TEXT,
        rule_json TEXT NOT NULL,
        allocation_role TEXT NOT NULL CHECK (allocation_role IN ('allocation', 'informational')),
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE budget_templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        structure_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pay_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        annual_salary_minor INTEGER NOT NULL,
        pension_rate_bps INTEGER NOT NULL,
        pension_method TEXT NOT NULL,
        pension_basis TEXT NOT NULL DEFAULT 'whole_salary',
        country TEXT NOT NULL DEFAULT 'england',
        tax_year TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE pay_estimate_snapshots (
        id TEXT PRIMARY KEY NOT NULL,
        budget_row_id TEXT REFERENCES budget_rows(id) ON DELETE SET NULL,
        inputs_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        ruleset_version TEXT NOT NULL,
        calculated_at TEXT NOT NULL
      );

      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}
