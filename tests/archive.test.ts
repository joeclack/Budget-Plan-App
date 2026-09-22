import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBudgetArchive,
  serializeBudgetArchive,
  type BudgetArchive,
} from "../src/domain/backup";
import { createBlankMonth } from "../src/domain/budget";

function archive(patch: Partial<BudgetArchive> = {}): BudgetArchive {
  const month = createBlankMonth(2026, 9);
  month.month.id = "september";
  month.month.revision = 1;
  return {
    format: "budget-plan-backup",
    version: 1,
    exportedAt: "2026-09-22T12:00:00.000Z",
    months: [month],
    templates: [],
    payProfile: null,
    paySnapshots: [],
    selectedMonthId: "september",
    groupPresentation: { "missing-group": { collapsed: true, sort: "date" } },
    autoApplyRecentMonth: false,
    ...patch,
  };
}

test("a backup file round-trips and drops presentation entries that are not a group layout", () => {
  const parsed = parseBudgetArchive(serializeBudgetArchive(archive()));
  assert.equal(parsed.months[0].month.id, "september");
  assert.equal(parsed.selectedMonthId, "september");
  assert.deepEqual(parsed.groupPresentation, {
    "missing-group": { collapsed: true, sort: "date" },
  });
  assert.equal(parsed.autoApplyRecentMonth, false);
  assert.equal(
    parseBudgetArchive(
      JSON.stringify({ ...archive(), autoApplyRecentMonth: true }),
    ).autoApplyRecentMonth,
    true,
  );
  assert.equal(
    parseBudgetArchive(
      JSON.stringify({ ...archive(), autoApplyRecentMonth: undefined }),
    ).autoApplyRecentMonth,
    false,
  );
  const noisy = {
    ...archive(),
    groupPresentation: {
      "missing-group": { collapsed: true, sort: "date" },
      broken: { collapsed: "yes", sort: "date" },
    },
  };
  assert.deepEqual(
    parseBudgetArchive(JSON.stringify(noisy)).groupPresentation,
    {
      "missing-group": { collapsed: true, sort: "date" },
    },
  );
});

test("backup files that are not this app, are newer, or disagree with themselves are refused", () => {
  assert.throws(
    () => parseBudgetArchive("not json"),
    /not a Budget Plan backup/,
  );
  assert.throws(
    () => parseBudgetArchive(JSON.stringify({ ...archive(), version: 2 })),
    /newer version/,
  );
  assert.throws(
    () => parseBudgetArchive(JSON.stringify({ ...archive(), format: "other" })),
    /not a Budget Plan backup/,
  );
  const duplicate = archive();
  const second = createBlankMonth(2026, 9);
  second.month.revision = 1;
  duplicate.months = [duplicate.months[0], second];
  assert.throws(
    () => parseBudgetArchive(JSON.stringify(duplicate)),
    /same calendar/,
  );
  assert.throws(
    () =>
      parseBudgetArchive(
        JSON.stringify({ ...archive(), selectedMonthId: "missing" }),
      ),
    /selected month/,
  );
  assert.throws(() => parseBudgetArchive("x".repeat(5_000_001)), /too large/);
  assert.throws(
    () =>
      parseBudgetArchive(
        JSON.stringify({ ...archive(), autoApplyRecentMonth: "yes" }),
      ),
    /copy-last-month/,
  );
});
