import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserRepository } from "../src/db/browser-repository";
import { copyBudget, evaluateBudget, setRowRule } from "../src/domain/budget";
import { createExampleBudget } from "../src/data/example-budget";
import { initialiseBudget } from "../src/features/budget/initialise";

test("example allocations and subscriptions total reconcile without double counting", () => {
  const result = evaluateBudget(createExampleBudget(2026, 9));
  assert.deepEqual(result.income, { ok: true, amountMinor: 342000 });
  assert.deepEqual(result.allocated, { ok: true, amountMinor: 287500 });
  assert.deepEqual(result.leftToPlan, { ok: true, amountMinor: 54500 });
});

test("concurrent initialisation seeds once and later reopens edits and selected copies", async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const repository = createBrowserRepository(storage);
  const [a, b] = await Promise.all([
    initialiseBudget(repository),
    initialiseBudget(repository),
  ]);
  assert.equal(a.document?.month.id, b.document?.month.id);
  assert.equal((await repository.listMonths()).length, 1);
  assert.ok(a.document);
  const salary = a.document.rows.find((row) => row.label === "Salary")!;
  const saved = await repository.saveMonth(
    setRowRule(a.document, salary.id, { kind: "fixed", amountMinor: 400000 }),
  );
  const nextYear =
    saved.month.month === 12 ? saved.month.year + 1 : saved.month.year;
  const nextMonth = saved.month.month === 12 ? 1 : saved.month.month + 1;
  const copied = await repository.saveMonth(
    copyBudget(saved, nextYear, nextMonth),
  );
  await repository.setSelectedMonthId(copied.month.id);
  const reopened = await initialiseBudget(createBrowserRepository(storage));
  assert.equal(reopened.document?.month.id, copied.month.id);
  assert.equal(reopened.months.length, 2);
  assert.deepEqual(evaluateBudget(reopened.document!).leftToPlan, {
    ok: true,
    amountMinor: 106700,
  });
});

test("corrupt saved state is reported without being replaced with an example", async () => {
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
