import {
  assertForeignKeys,
  inTransaction,
  serializeDatabase,
  type SqlConnection,
  type SqlDatabase,
} from "./sql";

export const DATABASE_VERSION = 7;

export async function ensureTemplateIdColumn(connection: SqlConnection) {
  const columns = await connection.getAllAsync<{ name: string }>(
    "PRAGMA table_info(budget_months)",
  );
  if (
    columns.length === 0 ||
    columns.some((column) => column.name === "template_id")
  )
    return;
  await connection.execAsync(
    "ALTER TABLE budget_months ADD COLUMN template_id TEXT;",
  );
}

/**
 * Versions 5–7 were unreleased local experiments. They only added columns this
 * schema ignores: nullable `actual_minor` and `template_id`, and
 * `employer_pension_rate_bps` with a default. Those files reopen as version 4.
 * The next real schema change must use version 8 or higher.
 */
const REOPENABLE_VERSION = 7;

export async function migrateDatabase(db: SqlDatabase) {
  return serializeDatabase(db, async () => {
    await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    await inTransaction(db, async (transaction) => {
      const result = await transaction.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version",
      );
      const currentVersion = result?.user_version ?? 0;

      if (currentVersion > DATABASE_VERSION) {
        if (currentVersion > REOPENABLE_VERSION) {
          throw new Error(
            "This database was created by a newer app version. Update the app before opening it.",
          );
        }
        await transaction.execAsync(
          `PRAGMA user_version = ${DATABASE_VERSION};`,
        );
        return;
      }
      if (currentVersion === DATABASE_VERSION) {
        await ensureTemplateIdColumn(transaction);
        return;
      }

      if (currentVersion === 0) {
        await transaction.execAsync(`
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

      if (currentVersion < 2)
        await transaction.execAsync(`
    ALTER TABLE budget_months ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 0);
    CREATE INDEX budget_groups_month_order ON budget_groups(month_id, sort_order, id);
    CREATE INDEX budget_rows_group_order ON budget_rows(group_id, sort_order, id);
    CREATE INDEX pay_snapshots_budget_row ON pay_estimate_snapshots(budget_row_id);
  `);
      if (currentVersion < 3)
        await transaction.execAsync(
          "ALTER TABLE budget_rows ADD COLUMN due_day INTEGER CHECK (due_day BETWEEN 1 AND 31);",
        );
      if (currentVersion < 4)
        await transaction.execAsync(
          "ALTER TABLE budget_groups ADD COLUMN color TEXT CHECK (color IS NULL OR color IN ('sky', 'ocean', 'mint', 'sun', 'peach', 'rose', 'orchid', 'violet'));",
        );
      if (currentVersion < 5)
        await transaction.execAsync(
          "ALTER TABLE budget_rows ADD COLUMN actual_minor INTEGER;",
        );
      if (currentVersion < 6) await ensureTemplateIdColumn(transaction);
      if (currentVersion < 7)
        await transaction.execAsync(
          "ALTER TABLE pay_profiles ADD COLUMN employer_pension_rate_bps INTEGER NOT NULL DEFAULT 0;",
        );
      await assertForeignKeys(transaction);
      await transaction.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
    });
  });
}
