import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserRepository } from "../src/db/browser-repository";
import { copyBudget, setRowRule } from "../src/domain/budget";
import { initialiseBudget } from "../src/features/budget/initialise";
import { createBudgetFixture } from "./budget-fixture";

function memory() {
  const data = new Map<string, string>();
  return {
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    },
  };
}

test("a fresh installation opens the current month without creating demo data", async () => {
  const { storage } = memory();
  const repository = createBrowserRepository(storage);
  const [a, b] = await Promise.all([
    initialiseBudget(repository),
    initialiseBudget(repository),
  ]);
  assert.equal(a.document, null);
  assert.equal(b.document, null);
  assert.deepEqual(a.months, []);
  assert.equal((await repository.listMonths()).length, 0);
  const now = new Date();
  assert.deepEqual(a.period, {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
});

test("legacy generated demo months are removed while personal months reopen", async () => {
  const { storage } = memory();
  const repository = createBrowserRepository(storage);
  const demo = createBudgetFixture();
  demo.month.name = "Example budget";
  await repository.saveMonth(demo);
  const personal = await repository.saveMonth(
    copyBudget(createBudgetFixture(), 2026, 10),
  );
  await repository.setSelectedMonthId(personal.month.id);
  const opened = await initialiseBudget(repository);
  assert.equal(opened.months.length, 1);
  assert.equal(opened.document?.month.id, personal.month.id);
  assert.equal(await repository.loadMonth(demo.month.id), null);
});

test("saved edits and selected copies reopen without being reseeded", async () => {
  const { storage } = memory();
  const repository = createBrowserRepository(storage);
  const original = await repository.saveMonth(createBudgetFixture());
  const salary = original.rows.find((row) => row.label === "Salary")!;
  const edited = await repository.saveMonth(
    setRowRule(original, salary.id, { kind: "fixed", amountMinor: 400000 }),
  );
  const copied = await repository.saveMonth(copyBudget(edited, 2026, 10));
  await repository.setSelectedMonthId(copied.month.id);
  const reopened = await initialiseBudget(createBrowserRepository(storage));
  assert.equal(reopened.document?.month.id, copied.month.id);
  assert.equal(reopened.months.length, 2);
});

test("corrupt saved state is reported without being replaced", async () => {
  let writes = 0;
  const repository = createBrowserRepository({
    getItem: () => "{broken",
    setItem: () => {
      writes++;
    },
  });
  await assert.rejects(initialiseBudget(repository));
  await assert.rejects(initialiseBudget(repository));
  assert.equal(writes, 0);
});
