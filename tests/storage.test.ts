import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test, { type TestContext } from "node:test";

import {
  copyBudget,
  createTemplate,
  evaluateBudget,
  instantiateTemplate,
} from "../src/domain/budget";
import type { BudgetDocument } from "../src/domain/budget/types";
import { migrateDatabase } from "../src/db/migrate";
import {
  BudgetStorageError,
  createBudgetRepository,
} from "../src/db/repository";
import { assertForeignKeys, inTransaction } from "../src/db/sql";
import { openTestDatabase } from "./sqlite-adapter";

function fixture(id = "september", month = 9): BudgetDocument {
  const stamp = "2026-09-20T12:00:00.000Z";
  return {
    month: {
      id,
      year: 2026,
      month,
      name: "Household",
      isLocked: false,
      createdAt: stamp,
      updatedAt: stamp,
      revision: 0,
    },
    groups: [
      {
        id: `${id}-income`,
        monthId: id,
        title: "Income",
        classification: "income",
        sortOrder: 0,
      },
      {
        id: `${id}-bills`,
        monthId: id,
        title: "Bills",
        classification: "expense",
        sortOrder: 1,
      },
      {
        id: `${id}-savings`,
        monthId: id,
        title: "Savings",
        classification: "saving",
        sortOrder: 2,
      },
    ],
    rows: [
      {
        id: `${id}-salary`,
        groupId: `${id}-income`,
        label: "Salary",
        notes: "",
        rule: { kind: "fixed", amountMinor: 342000 },
        allocationRole: "allocation",
        sortOrder: 0,
      },
      {
        id: `${id}-rent`,
        groupId: `${id}-bills`,
        label: "Rent",
        notes: "",
        rule: { kind: "fixed", amountMinor: 110000 },
        allocationRole: "allocation",
        sortOrder: 0,
      },
      {
        id: `${id}-holiday`,
        groupId: `${id}-savings`,
        label: "Holiday",
        notes: "",
        rule: {
          kind: "percentage",
          rate: "10",
          source: { kind: "row", id: `${id}-salary` },
        },
        allocationRole: "allocation",
        sortOrder: 0,
      },
      {
        id: `${id}-bill-total`,
        groupId: `${id}-savings`,
        label: "Bills total",
        notes: "Reference only",
        rule: { kind: "groupTotal", groupId: `${id}-bills` },
        allocationRole: "informational",
        sortOrder: 1,
      },
    ],
  };
}

async function setup(t: TestContext, migrate = true) {
  const directory = await mkdtemp(join(tmpdir(), "budget-storage-"));
  const path = join(directory, "budget.db");
  const opened: ReturnType<typeof openTestDatabase>[] = [];
  const open = () => {
    const db = openTestDatabase(path);
    opened.push(db);
    return db;
  };
  const db = open();
  t.after(async () => {
    for (const item of opened) {
      try {
        item.close();
      } catch {
        /* Already explicitly closed to test restart. */
      }
    }
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`));
    await rm(directory, { recursive: true, force: true });
  });
  if (migrate) await migrateDatabase(db);
  return { db, open, repository: createBudgetRepository(db) };
}

const hasCode = (code: string) => (error: unknown) =>
  error instanceof BudgetStorageError && error.code === code;

test("explicit lock and unlock persist, preserve contents and reject stale writers", async (t) => {
  const { repository, open } = await setup(t);
  const initial = await repository.saveMonth(fixture());
  const locked = await repository.setMonthLocked(
    initial.month.id,
    initial.month.revision,
    true,
  );
  assert.equal(locked.month.isLocked, true);
  assert.deepEqual(locked.rows, initial.rows);
  assert.deepEqual(locked.groups, initial.groups);
  await assert.rejects(repository.saveMonth(initial), hasCode("LOCKED"));
  await assert.rejects(
    repository.setMonthLocked(initial.month.id, initial.month.revision, false),
    hasCode("CONFLICT"),
  );
  const reopened = createBudgetRepository(open());
  assert.equal(
    (await reopened.loadMonth(initial.month.id))!.month.isLocked,
    true,
  );
  const unlocked = await reopened.setMonthLocked(
    locked.month.id,
    locked.month.revision,
    false,
  );
  assert.equal(unlocked.month.isLocked, false);
  assert.deepEqual(unlocked.rows, initial.rows);
  await assert.rejects(repository.saveMonth(initial), hasCode("CONFLICT"));
  assert.equal(
    (await repository.saveMonth(unlocked)).month.revision,
    unlocked.month.revision + 1,
  );
});

test("a budget reopens from disk, recalculates and retains selection without reseeding", async (t) => {
  const { db, open, repository } = await setup(t);
  const original = fixture();
  const saved = await repository.saveMonth(original);
  assert.equal(original.month.revision, 0);
  assert.equal(saved.month.revision, 1);
  await repository.setSelectedMonthId(saved.month.id);
  db.close();
  const reopened = open();
  await migrateDatabase(reopened);
  const next = createBudgetRepository(reopened);
  assert.deepEqual(await next.loadMonth(saved.month.id), saved);
  assert.deepEqual(
    evaluateBudget((await next.findMonth(2026, 9))!),
    evaluateBudget(saved),
  );
  assert.equal(await next.getSelectedMonthId(), saved.month.id);
  assert.equal((await next.listMonths()).length, 1);
  assert.equal(await next.findMonth(2026, 10), null);
  await assert.rejects(
    next.setSelectedMonthId("missing"),
    hasCode("NOT_FOUND"),
  );
});

test("an injected failure partway through a save rolls all month, group and row writes back", async (t) => {
  const { db, repository } = await setup(t);
  const saved = await repository.saveMonth(fixture());
  await db.execAsync(`CREATE TRIGGER fail_holiday BEFORE INSERT ON budget_rows
    WHEN NEW.label = 'Reject this change' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`);
  const draft = structuredClone(saved);
  draft.month.name = "Changed name";
  draft.groups[0].title = "Changed income";
  draft.rows[0].rule = { kind: "fixed", amountMinor: 500000 };
  draft.rows[2].label = "Reject this change";
  await assert.rejects(repository.saveMonth(draft), /injected failure/);
  assert.deepEqual(await repository.loadMonth(saved.month.id), saved);
  assert.equal((await repository.listMonths())[0].revision, 1);
});

test("stale writes, duplicate target months and foreign identifiers are rejected atomically", async (t) => {
  const { repository } = await setup(t);
  const saved = await repository.saveMonth(fixture());
  const updated = await repository.saveMonth(saved);
  assert.equal(updated.month.revision, 2);
  await assert.rejects(repository.saveMonth(saved), hasCode("CONFLICT"));
  await assert.rejects(
    repository.saveMonth(fixture("duplicate", 9)),
    hasCode("DUPLICATE_MONTH"),
  );
  const foreignGroup = fixture("october", 10);
  foreignGroup.groups[0].id = saved.groups[0].id;
  foreignGroup.rows[0].groupId = saved.groups[0].id;
  await assert.rejects(
    repository.saveMonth(foreignGroup),
    hasCode("FOREIGN_ID"),
  );
  const foreignRow = fixture("october", 10);
  foreignRow.rows[0].id = saved.rows[0].id;
  foreignRow.rows[2].rule = {
    kind: "percentage",
    rate: "10",
    source: { kind: "row", id: saved.rows[0].id },
  };
  await assert.rejects(repository.saveMonth(foreignRow), hasCode("FOREIGN_ID"));
  assert.equal((await repository.listMonths()).length, 1);
  assert.deepEqual(await repository.loadMonth(updated.month.id), updated);
});

test("a locked stored month cannot be edited or unlocked through a stale draft", async (t) => {
  const { repository } = await setup(t);
  const document = fixture();
  document.month.isLocked = true;
  const saved = await repository.saveMonth(document);
  const draft = structuredClone(saved);
  draft.month.isLocked = false;
  draft.rows[0].label = "Changed";
  await assert.rejects(repository.saveMonth(draft), hasCode("LOCKED"));
  assert.deepEqual(await repository.loadMonth(saved.month.id), saved);
});

test("updates and moves preserve pay snapshots; removing a row detaches its snapshot", async (t) => {
  const { db, repository } = await setup(t);
  const saved = await repository.saveMonth(fixture());
  const rentId = "september-rent";
  await db.runAsync(
    "INSERT INTO pay_estimate_snapshots (id, budget_row_id, inputs_json, result_json, ruleset_version, calculated_at) VALUES (?, ?, ?, ?, ?, ?)",
    "snapshot",
    rentId,
    "{}",
    "{}",
    "preview",
    "2026-09-20",
  );
  const draft = structuredClone(saved);
  draft.rows.find((row) => row.id === rentId)!.groupId = "september-savings";
  const updated = await repository.saveMonth(draft);
  assert.equal(
    (
      await db.getFirstAsync<{ budget_row_id: string }>(
        "SELECT budget_row_id FROM pay_estimate_snapshots WHERE id = 'snapshot'",
      )
    )?.budget_row_id,
    rentId,
  );
  updated.rows = updated.rows.filter((row) => row.id !== rentId);
  await repository.saveMonth(updated);
  assert.equal(
    (
      await db.getFirstAsync<{ budget_row_id: string | null }>(
        "SELECT budget_row_id FROM pay_estimate_snapshots WHERE id = 'snapshot'",
      )
    )?.budget_row_id,
    null,
  );
  assert.deepEqual(await db.getAllAsync("PRAGMA foreign_key_check"), []);
});

test("foreign keys apply on the provider connection and are checked on isolated transaction connections", async (t) => {
  const { db } = await setup(t);
  await assert.rejects(
    db.runAsync(
      "INSERT INTO budget_groups (id, month_id, title, classification, sort_order) VALUES (?, ?, ?, ?, ?)",
      "orphan",
      "missing",
      "Broken",
      "expense",
      0,
    ),
    /FOREIGN KEY constraint/,
  );
  await assert.rejects(
    inTransaction(db, async (transaction) => {
      await transaction.runAsync(
        "INSERT INTO budget_groups (id, month_id, title, classification, sort_order) VALUES (?, ?, ?, ?, ?)",
        "orphan",
        "missing",
        "Broken",
        "expense",
        0,
      );
      await assertForeignKeys(transaction);
    }),
    /invalid database references/,
  );
  assert.equal(
    await db.getFirstAsync("SELECT * FROM budget_groups WHERE id = 'orphan'"),
    null,
  );
});

test("copied months and reusable templates remap references and remain independent after reopen", async (t) => {
  const { db, open, repository } = await setup(t);
  const source = await repository.saveMonth(fixture());
  const copy = await repository.saveMonth(copyBudget(source, 2026, 10));
  const template = await repository.saveTemplate(
    createTemplate(source, "Standard household"),
  );
  const fromTemplate = await repository.saveMonth(
    instantiateTemplate(template, 2026, 11),
  );
  assert.deepEqual(
    evaluateBudget(copy).leftToPlan,
    evaluateBudget(source).leftToPlan,
  );
  assert.deepEqual(
    evaluateBudget(fromTemplate).leftToPlan,
    evaluateBudget(source).leftToPlan,
  );
  const draft = structuredClone(copy);
  const salary = draft.rows.find((row) => row.label === "Salary")!;
  salary.rule = { kind: "fixed", amountMinor: 400000 };
  await repository.saveMonth(draft);
  assert.deepEqual(await repository.loadMonth(source.month.id), source);
  assert.deepEqual(await repository.loadTemplate(template.id), template);
  db.close();
  const next = createBudgetRepository(open());
  assert.deepEqual(await next.loadMonth(source.month.id), source);
  assert.deepEqual(await next.loadMonth(fromTemplate.month.id), fromTemplate);
  assert.deepEqual(await next.listTemplates(), [template]);
  assert.deepEqual(
    (await next.listMonths()).map((month) => month.month),
    [11, 10, 9],
  );
});

test("concurrent saves serialize across repository instances without lost updates", async (t) => {
  const { db, repository } = await setup(t);
  const saved = await repository.saveMonth(fixture());
  const other = createBudgetRepository(db);
  const results = await Promise.allSettled([
    repository.saveMonth(saved),
    other.saveMonth(saved),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(
    rejected?.status === "rejected" && hasCode("CONFLICT")(rejected.reason),
  );
  assert.equal((await repository.loadMonth(saved.month.id))?.month.revision, 2);
});

test("a queued save cannot be changed by mutating the caller's object", async (t) => {
  const { repository } = await setup(t);
  const input = fixture();
  const pending = repository.saveMonth(input);
  input.rows[0].label = "Mutated after save";
  const saved = await pending;
  assert.equal(saved.rows[0].label, "Salary");
});

test("newer database versions are refused without changing data", async (t) => {
  const { db, repository } = await setup(t);
  const saved = await repository.saveMonth(fixture());
  await db.execAsync("PRAGMA user_version = 99");
  await assert.rejects(migrateDatabase(db), /newer app version/);
  assert.deepEqual(await repository.loadMonth(saved.month.id), saved);
  assert.equal(
    (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version,
    99,
  );
});

// Frozen Milestone 1 schema, deliberately independent of the migration implementation.
const legacySchema = `
  CREATE TABLE budget_months (id TEXT PRIMARY KEY NOT NULL, year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12), name TEXT NOT NULL,
    is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0,1)),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(year,month));
  CREATE TABLE budget_groups (id TEXT PRIMARY KEY NOT NULL,
    month_id TEXT NOT NULL REFERENCES budget_months(id) ON DELETE CASCADE,
    title TEXT NOT NULL, classification TEXT NOT NULL CHECK(classification IN ('income','expense','saving')),
    sort_order INTEGER NOT NULL);
  CREATE TABLE budget_rows (id TEXT PRIMARY KEY NOT NULL,
    group_id TEXT NOT NULL REFERENCES budget_groups(id) ON DELETE CASCADE,
    label TEXT NOT NULL, notes TEXT, rule_json TEXT NOT NULL,
    allocation_role TEXT NOT NULL CHECK(allocation_role IN ('allocation','informational')), sort_order INTEGER NOT NULL);
  CREATE TABLE budget_templates (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL,
    structure_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE pay_profiles (id TEXT PRIMARY KEY NOT NULL, annual_salary_minor INTEGER NOT NULL,
    pension_rate_bps INTEGER NOT NULL, pension_method TEXT NOT NULL,
    pension_basis TEXT NOT NULL DEFAULT 'whole_salary', country TEXT NOT NULL DEFAULT 'england',
    tax_year TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE pay_estimate_snapshots (id TEXT PRIMARY KEY NOT NULL,
    budget_row_id TEXT REFERENCES budget_rows(id) ON DELETE SET NULL, inputs_json TEXT NOT NULL,
    result_json TEXT NOT NULL, ruleset_version TEXT NOT NULL, calculated_at TEXT NOT NULL);
  CREATE TABLE app_settings (key TEXT PRIMARY KEY NOT NULL, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
  PRAGMA user_version = 1;
`;

test("version 1 upgrades preserve months, rules, pay data and settings", async (t) => {
  const { db, repository } = await setup(t, false);
  await db.execAsync(legacySchema);
  await db.runAsync(
    "INSERT INTO budget_months VALUES (?, ?, ?, ?, ?, ?, ?)",
    "old-month",
    2026,
    9,
    "September 2026",
    0,
    "2026-09-01T00:00:00.000Z",
    "2026-09-01T00:00:00.000Z",
  );
  await db.runAsync(
    "INSERT INTO budget_groups VALUES (?, ?, ?, ?, ?)",
    "old-group",
    "old-month",
    "Income",
    "income",
    0,
  );
  await db.runAsync(
    "INSERT INTO budget_rows VALUES (?, ?, ?, ?, ?, ?, ?)",
    "old-row",
    "old-group",
    "Legacy salary",
    null,
    JSON.stringify({ kind: "fixed", amountMinor: 12345 }),
    "allocation",
    0,
  );
  await db.runAsync(
    "INSERT INTO pay_estimate_snapshots VALUES (?, ?, ?, ?, ?, ?)",
    "old-snapshot",
    "old-row",
    "{}",
    "{}",
    "legacy",
    "2026-09-01T00:00:00.000Z",
  );
  await db.runAsync(
    "INSERT INTO pay_profiles VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    "old-profile",
    4800000,
    500,
    "salary_sacrifice",
    "whole_salary",
    "england",
    "2026/27",
    "2026-09-01T00:00:00.000Z",
  );
  await db.runAsync(
    "INSERT INTO app_settings VALUES (?, ?, ?)",
    "selectedMonthId",
    JSON.stringify("old-month"),
    "2026-09-01T00:00:00.000Z",
  );
  await migrateDatabase(db);
  const loaded = await repository.loadMonth("old-month");
  assert.ok(loaded);
  assert.equal(loaded.month.revision, 1);
  assert.equal(loaded.rows[0].notes, "");
  assert.deepEqual(loaded.rows[0].rule, { kind: "fixed", amountMinor: 12345 });
  assert.deepEqual(evaluateBudget(loaded).income, {
    ok: true,
    amountMinor: 12345,
  });
  assert.equal(await repository.getSelectedMonthId(), "old-month");
  assert.equal(
    (
      await db.getFirstAsync<{ budget_row_id: string }>(
        "SELECT budget_row_id FROM pay_estimate_snapshots",
      )
    )?.budget_row_id,
    "old-row",
  );
  assert.equal(
    (
      await db.getFirstAsync<{ pension_basis: string }>(
        "SELECT pension_basis FROM pay_profiles",
      )
    )?.pension_basis,
    "whole_salary",
  );
  assert.equal(
    (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version,
    2,
  );
  assert.equal((await repository.saveMonth(loaded)).month.revision, 2);
});

test("a failed schema migration rolls schema and version changes back together", async (t) => {
  const { db } = await setup(t, false);
  await db.execAsync(legacySchema);
  await db.execAsync("DROP TABLE pay_estimate_snapshots");
  await assert.rejects(migrateDatabase(db), /no such table/);
  assert.equal(
    (await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))
      ?.user_version,
    1,
  );
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(budget_months)",
  );
  assert.ok(!columns.some((column) => column.name === "revision"));
  assert.equal(
    await db.getFirstAsync(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'budget_groups_month_order'",
    ),
    null,
  );
});

test("loading a month uses one snapshot even when another connection writes between queries", async (t) => {
  const { db, repository } = await setup(t);
  const saved = await repository.saveMonth(fixture());
  let changed = false;
  const concurrent = createBudgetRepository({
    ...db,
    async withExclusiveTransactionAsync(task) {
      await db.withExclusiveTransactionAsync(async (connection) =>
        task({
          ...connection,
          async getAllAsync<T>(
            sql: string,
            ...params: import("../src/db/sql").SqlValue[]
          ) {
            if (!changed && sql.includes("SELECT * FROM budget_groups")) {
              changed = true;
              await db.runAsync(
                "UPDATE budget_rows SET rule_json = ? WHERE id = ?",
                JSON.stringify({ kind: "fixed", amountMinor: 500000 }),
                "september-salary",
              );
            }
            return connection.getAllAsync<T>(sql, ...params);
          },
        }),
      );
    },
  });
  assert.deepEqual(await concurrent.loadMonth(saved.month.id), saved);
  assert.ok(changed);
  assert.deepEqual(
    (await repository.loadMonth(saved.month.id))!.rows.find(
      (row) => row.id === "september-salary",
    )!.rule,
    { kind: "fixed", amountMinor: 500000 },
  );
});

test("invalid dependency removal and malformed JSON rules never replace saved data", async (t) => {
  const { repository } = await setup(t);
  const saved = await repository.saveMonth(fixture());
  const removedSource = structuredClone(saved);
  removedSource.rows = removedSource.rows.filter(
    (row) => row.id !== "september-salary",
  );
  await assert.rejects(repository.saveMonth(removedSource));
  const malformed = structuredClone(saved);
  malformed.rows[0].rule = {
    kind: "expression",
    expression: { kind: "literal", value: "process.exit()" },
  };
  await assert.rejects(repository.saveMonth(malformed));
  assert.deepEqual(await repository.loadMonth(saved.month.id), saved);
});
