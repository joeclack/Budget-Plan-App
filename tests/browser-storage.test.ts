import assert from "node:assert/strict";
import test from "node:test";

import {
  BROWSER_STORAGE_KEY,
  createBrowserRepository,
  type BrowserStorage,
} from "../src/db/browser-repository";
import { BudgetStorageError } from "../src/db/repository";
import type { BudgetDocument, BudgetTemplate } from "../src/domain/budget";
import { calculatePay } from "../src/domain/pay";
import type { PayProfile } from "../src/domain/pay";

class MemoryStorage implements BrowserStorage {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("Storage quota exceeded");
    this.values.set(key, value);
  }
}

test("browser locks require current revisions, survive reload and preserve data on failure", async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserRepository(storage);
  const initial = await repository.saveMonth(document());
  const locked = await repository.setMonthLocked(
    initial.month.id,
    initial.month.revision,
    true,
  );
  await assert.rejects(repository.saveMonth(initial), /locked/);
  await assert.rejects(
    repository.setMonthLocked(initial.month.id, initial.month.revision, false),
    /changed/,
  );
  storage.failWrites = true;
  await assert.rejects(
    repository.setMonthLocked(locked.month.id, locked.month.revision, false),
    /quota/,
  );
  storage.failWrites = false;
  const reopened = createBrowserRepository(storage);
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
});

function document(id = "september", month = 9): BudgetDocument {
  return {
    month: {
      id,
      year: 2026,
      month,
      name: id,
      isLocked: false,
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
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
    ],
  };
}

function template(): BudgetTemplate {
  const budget = document("template");
  return {
    id: "template",
    name: "Regular month",
    createdAt: budget.month.createdAt,
    updatedAt: budget.month.updatedAt,
    structure: { version: 1, groups: budget.groups, rows: budget.rows },
  };
}

function hasCode(code: string) {
  return (error: unknown) =>
    error instanceof BudgetStorageError && error.code === code;
}

test("browser preview reopens saved budgets, templates and selected month", async () => {
  const storage = new MemoryStorage();
  const first = createBrowserRepository(storage);
  assert.equal(await first.loadMonth("missing"), null);
  assert.equal(await first.findMonth(2026, 9), null);
  assert.equal(await first.loadTemplate("missing"), null);
  assert.equal(await first.getSelectedMonthId(), null);
  const saved = await first.saveMonth(document());
  const savedTemplate = await first.saveTemplate(template());
  await first.setSelectedMonthId(saved.month.id);

  const reopened = createBrowserRepository(storage);
  assert.equal(saved.month.revision, 1);
  assert.deepEqual(await reopened.findMonth(2026, 9), saved);
  assert.deepEqual(await reopened.loadTemplate("template"), savedTemplate);
  assert.deepEqual(await reopened.listMonths(), [saved.month]);
  assert.equal(await reopened.getSelectedMonthId(), "september");
  assert.equal(storage.values.size, 1);
});

test("browser pay settings, due dates and an applied estimate persist atomically", async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserRepository(storage);
  const saved = await repository.saveMonth(document());
  saved.rows[0].dueDay = 28;
  const profile: PayProfile = {
    id: "primary",
    annualSalaryMinor: 4_800_000,
    pensionRateBps: 500,
    pensionMethod: "net_pay",
    pensionBasis: "whole_salary",
    country: "england",
    taxYear: "2026/27",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
  const storedProfile = await repository.savePayProfile(profile);
  const calculatedAt = "2026-09-21T12:00:00.000Z";
  const result = calculatePay(storedProfile, calculatedAt);
  saved.rows[0].rule = {
    kind: "fixed",
    amountMinor: result.monthlyTakeHomeMinor,
  };
  const applied = await repository.saveMonth(saved, {
    id: "pay-snapshot",
    budgetRowId: saved.rows[0].id,
    inputs: storedProfile,
    result,
    rulesetVersion: result.rulesetVersion,
    calculatedAt,
  });
  assert.equal(applied.rows[0].dueDay, 28);
  assert.equal(
    (applied.rows[0].rule as { kind: "fixed"; amountMinor: number })
      .amountMinor,
    301334,
  );
  assert.deepEqual(await repository.getPayProfile(), storedProfile);

  const before = storage.getItem(BROWSER_STORAGE_KEY);
  const invalid = structuredClone(applied);
  invalid.rows[0].rule = { kind: "fixed", amountMinor: 1 };
  await assert.rejects(
    repository.saveMonth(invalid, {
      id: "bad-snapshot",
      budgetRowId: invalid.rows[0].id,
      inputs: storedProfile,
      result: { ...result, monthlyTakeHomeMinor: 1 },
      rulesetVersion: result.rulesetVersion,
      calculatedAt,
    }),
    hasCode("INVALID_DATA"),
  );
  assert.equal(storage.getItem(BROWSER_STORAGE_KEY), before);
});

test("fresh snapshots prevent stale repository instances from overwriting newer revisions", async () => {
  const storage = new MemoryStorage();
  const first = createBrowserRepository(storage);
  const second = createBrowserRepository(storage);
  const saved = await first.saveMonth(document());
  const stale = await second.loadMonth(saved.month.id);
  assert.ok(stale);
  saved.rows[0].label = "New salary";
  const updated = await first.saveMonth(saved);
  stale.rows[0].label = "Stale edit";
  await assert.rejects(second.saveMonth(stale), hasCode("CONFLICT"));
  assert.equal(updated.month.revision, 2);
  assert.equal(
    (await second.loadMonth(saved.month.id))?.rows[0].label,
    "New salary",
  );
});

test("failed writes preserve the complete prior snapshot and remain retryable", async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserRepository(storage);
  const saved = await repository.saveMonth(document());
  const before = storage.getItem(BROWSER_STORAGE_KEY);
  saved.rows[0].label = "Not yet saved";
  storage.failWrites = true;
  await assert.rejects(repository.saveMonth(saved), /Storage quota exceeded/);
  await assert.rejects(
    repository.saveTemplate(template()),
    /Storage quota exceeded/,
  );
  await assert.rejects(
    repository.setSelectedMonthId(saved.month.id),
    /Storage quota exceeded/,
  );
  assert.equal(storage.getItem(BROWSER_STORAGE_KEY), before);
  assert.equal(
    (await repository.loadMonth(saved.month.id))?.rows[0].label,
    "Salary",
  );
  storage.failWrites = false;
  assert.equal((await repository.saveMonth(saved)).month.revision, 2);
});

test("inputs and returned documents cannot mutate persisted snapshots", async () => {
  const repository = createBrowserRepository(new MemoryStorage());
  const input = document();
  const saved = await repository.saveMonth(input);
  assert.equal(input.month.revision, 0);
  input.rows[0].label = "Input changed";
  saved.rows[0].label = "Result changed";
  const loaded = await repository.loadMonth(input.month.id);
  assert.ok(loaded);
  loaded.rows[0].label = "Read changed";
  assert.equal(
    (await repository.loadMonth(input.month.id))?.rows[0].label,
    "Salary",
  );
});

test("corrupt or newer snapshots are reported and never silently replaced", async () => {
  for (const raw of [
    "{broken json",
    JSON.stringify({ version: 1, months: [], templates: [] }),
    JSON.stringify({
      version: 1,
      months: [document()],
      templates: [],
      selectedMonthId: null,
    }),
    JSON.stringify({
      version: 1,
      months: [],
      templates: [],
      selectedMonthId: "missing",
    }),
    JSON.stringify({
      version: 2,
      months: [],
      templates: [],
      selectedMonthId: null,
    }),
  ]) {
    const storage = new MemoryStorage();
    storage.setItem(BROWSER_STORAGE_KEY, raw);
    const repository = createBrowserRepository(storage);
    const code = raw.includes('"version":2') ? "NEWER_SCHEMA" : "INVALID_DATA";
    await assert.rejects(repository.listMonths(), hasCode(code));
    await assert.rejects(repository.saveMonth(document()), hasCode(code));
    assert.equal(storage.getItem(BROWSER_STORAGE_KEY), raw);
  }
});

test("months are unique, foreign row IDs are rejected, and locked months cannot be edited", async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserRepository(storage);
  const saved = await repository.saveMonth(document());
  await assert.rejects(
    repository.saveMonth(document("duplicate")),
    hasCode("DUPLICATE_MONTH"),
  );
  const october = document("october", 10);
  october.rows[0].id = saved.rows[0].id;
  await assert.rejects(repository.saveMonth(october), hasCode("FOREIGN_ID"));
  const locked = await repository.saveMonth({
    ...saved,
    month: { ...saved.month, isLocked: true },
  });
  locked.rows[0].label = "Cannot save";
  await assert.rejects(repository.saveMonth(locked), hasCode("LOCKED"));
});

test("invalid budgets and templates leave valid saved data intact", async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserRepository(storage);
  const saved = await repository.saveMonth(document());
  const before = storage.getItem(BROWSER_STORAGE_KEY);
  saved.rows[0].rule = {
    kind: "percentage",
    rate: "10",
    source: { kind: "row", id: "missing" },
  };
  await assert.rejects(repository.saveMonth(saved));
  const invalidTemplate = template();
  invalidTemplate.structure.groups[0].monthId = "foreign";
  await assert.rejects(repository.saveTemplate(invalidTemplate));
  assert.equal(storage.getItem(BROWSER_STORAGE_KEY), before);
});

test("month ordering, template replacement and invalid selection rejection survive reload", async () => {
  const storage = new MemoryStorage();
  const repository = createBrowserRepository(storage);
  await repository.saveMonth(document());
  await repository.saveMonth(document("october", 10));
  assert.deepEqual(
    (await repository.listMonths()).map((month) => month.month),
    [10, 9],
  );
  const saved = await repository.saveTemplate(template());
  saved.name = "Updated template";
  await repository.saveTemplate(saved);
  await repository.setSelectedMonthId("september");
  await assert.rejects(
    repository.setSelectedMonthId("missing"),
    hasCode("NOT_FOUND"),
  );
  const reopened = createBrowserRepository(storage);
  assert.equal(await reopened.getSelectedMonthId(), "september");
  await repository.saveGroupPresentation({
    income: { collapsed: true, sort: "date" },
  });
  assert.deepEqual(await createBrowserRepository(storage).getGroupPresentation(), {
    income: { collapsed: true, sort: "date" },
  });
  assert.deepEqual(
    (await reopened.listTemplates()).map((item) => item.name),
    ["Updated template"],
  );
});

test("template timestamps reject stale writers and advance on rapid consecutive saves", async () => {
  const storage = new MemoryStorage();
  const first = createBrowserRepository(storage);
  const second = createBrowserRepository(storage);
  const saved = await first.saveTemplate(template());
  const stale = await second.loadTemplate(saved.id);
  assert.ok(stale);
  const updated = await first.saveTemplate({
    ...saved,
    name: "Current version",
  });
  assert.ok(Date.parse(updated.updatedAt) > Date.parse(saved.updatedAt));
  await assert.rejects(
    second.saveTemplate({ ...stale, name: "Stale version" }),
    hasCode("CONFLICT"),
  );
  assert.equal((await second.loadTemplate(saved.id))?.name, "Current version");
  await assert.rejects(
    second.deleteTemplate(stale.id, stale.updatedAt),
    hasCode("CONFLICT"),
  );
  await second.deleteTemplate(updated.id, updated.updatedAt);
  assert.deepEqual(await first.listTemplates(), []);
  await assert.rejects(
    first.deleteTemplate(updated.id, updated.updatedAt),
    hasCode("NOT_FOUND"),
  );
});
