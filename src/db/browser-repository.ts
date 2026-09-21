import {
  assertValidBudget,
  assertValidTemplate,
  type BudgetDocument,
  type BudgetTemplate,
} from "../domain/budget";
import { BudgetStorageError, type BudgetRepository } from "./repository";
import { calculatePay, validatePayProfile } from "../domain/pay";
import type { PayEstimateSnapshot, PayProfile } from "../domain/pay";

/** Browser preview only. The iPhone app uses its native SQLite repository. */
export const BROWSER_STORAGE_KEY = "budget-plan-preview-v1";

export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type Snapshot = {
  version: 1;
  months: BudgetDocument[];
  templates: BudgetTemplate[];
  selectedMonthId: string | null;
  payProfile?: PayProfile | null;
  paySnapshots?: PayEstimateSnapshot[];
};

function invalidStorage(): BudgetStorageError {
  return new BudgetStorageError(
    "INVALID_DATA",
    "The saved browser preview is invalid. Your existing data has not been changed.",
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertId(id: string) {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new BudgetStorageError("INVALID_DATA", "An identifier is required.");
  }
}

function compareId(a: { id: string }, b: { id: string }) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sortDocument(document: BudgetDocument) {
  document.groups.sort((a, b) => a.sortOrder - b.sortOrder || compareId(a, b));
  const groupOrder = new Map(
    document.groups.map((group, index) => [group.id, index]),
  );
  document.rows.sort(
    (a, b) =>
      groupOrder.get(a.groupId)! - groupOrder.get(b.groupId)! ||
      a.sortOrder - b.sortOrder ||
      compareId(a, b),
  );
  return document;
}

function assertPaySnapshot(value: PayEstimateSnapshot) {
  validatePayProfile(value.inputs);
  const expected = calculatePay(value.inputs, value.calculatedAt);
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    typeof value.budgetRowId !== "string" ||
    !value.budgetRowId.trim() ||
    value.rulesetVersion !== expected.rulesetVersion ||
    JSON.stringify(value.result) !== JSON.stringify(expected)
  )
    throw invalidStorage();
}

function validateSnapshot(value: unknown): asserts value is Snapshot {
  if (typeof value !== "object" || value === null) throw invalidStorage();
  const snapshot = value as Partial<Snapshot>;
  if (typeof snapshot.version === "number" && snapshot.version > 1) {
    throw new BudgetStorageError(
      "NEWER_SCHEMA",
      "This browser preview was saved by a newer app version.",
    );
  }
  if (
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.months) ||
    !Array.isArray(snapshot.templates) ||
    !(
      snapshot.selectedMonthId === null ||
      typeof snapshot.selectedMonthId === "string"
    )
  ) {
    throw invalidStorage();
  }

  const monthIds = new Set<string>();
  const calendarMonths = new Set<string>();
  const groupIds = new Set<string>();
  const rowIds = new Set<string>();
  const templateIds = new Set<string>();
  function requireUnique(ids: Set<string>, id: string) {
    if (ids.has(id)) throw invalidStorage();
    ids.add(id);
  }
  try {
    for (const document of snapshot.months) {
      assertValidBudget(document);
      if (document.month.revision < 1) throw invalidStorage();
      requireUnique(monthIds, document.month.id);
      requireUnique(
        calendarMonths,
        `${document.month.year}-${document.month.month}`,
      );
      for (const group of document.groups) requireUnique(groupIds, group.id);
      for (const row of document.rows) requireUnique(rowIds, row.id);
    }
    for (const template of snapshot.templates) {
      assertValidTemplate(template);
      requireUnique(templateIds, template.id);
    }
    if (snapshot.payProfile) validatePayProfile(snapshot.payProfile);
    if (snapshot.paySnapshots !== undefined) {
      if (!Array.isArray(snapshot.paySnapshots)) throw invalidStorage();
      const snapshotIds = new Set<string>();
      for (const paySnapshot of snapshot.paySnapshots) {
        assertPaySnapshot(paySnapshot);
        requireUnique(snapshotIds, paySnapshot.id);
        if (!rowIds.has(paySnapshot.budgetRowId)) throw invalidStorage();
      }
    }
  } catch {
    throw invalidStorage();
  }
  if (
    snapshot.selectedMonthId !== null &&
    !monthIds.has(snapshot.selectedMonthId)
  ) {
    throw invalidStorage();
  }
}

/** Each operation reads fresh storage; failed writes never update a memory cache. */
export function createBrowserRepository(
  storage: BrowserStorage,
): BudgetRepository {
  function read(): Snapshot {
    const raw = storage.getItem(BROWSER_STORAGE_KEY);
    if (raw === null) {
      return {
        version: 1,
        months: [],
        templates: [],
        selectedMonthId: null,
        payProfile: null,
        paySnapshots: [],
      };
    }
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(raw);
    } catch {
      throw invalidStorage();
    }
    validateSnapshot(snapshot);
    return snapshot;
  }

  function write(snapshot: Snapshot) {
    // One setItem replaces the snapshot atomically, including related rows and groups.
    storage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(snapshot));
  }

  return {
    async removeDemoData() {
      const snapshot = read();
      const demoIds = new Set(
        snapshot.months
          .filter((item) => item.month.name === "Example budget")
          .map((item) => item.month.id),
      );
      if (!demoIds.size) return;
      snapshot.months = snapshot.months.filter(
        (item) => !demoIds.has(item.month.id),
      );
      const retainedRowIds = new Set(
        snapshot.months.flatMap((item) => item.rows.map((row) => row.id)),
      );
      snapshot.paySnapshots = (snapshot.paySnapshots ?? []).filter((item) =>
        retainedRowIds.has(item.budgetRowId),
      );
      if (snapshot.selectedMonthId && demoIds.has(snapshot.selectedMonthId))
        snapshot.selectedMonthId = null;
      write(snapshot);
    },
    async listMonths() {
      return read()
        .months.map((document) => document.month)
        .sort(
          (a, b) => b.year - a.year || b.month - a.month || compareId(a, b),
        );
    },
    async loadMonth(id) {
      assertId(id);
      const document = read().months.find(
        (document) => document.month.id === id,
      );
      return document ? sortDocument(document) : null;
    },
    async findMonth(year, month) {
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
      const document = read().months.find(
        (document) =>
          document.month.year === year && document.month.month === month,
      );
      return document ? sortDocument(document) : null;
    },
    async saveMonth(document, inputSnapshot) {
      assertValidBudget(document);
      if (inputSnapshot) {
        try {
          assertPaySnapshot(inputSnapshot);
        } catch {
          throw new BudgetStorageError(
            "INVALID_DATA",
            "Invalid pay estimate snapshot.",
          );
        }
      }
      const snapshot = read();
      const existing = snapshot.months.find(
        (item) => item.month.id === document.month.id,
      );
      if (existing?.month.isLocked) {
        throw new BudgetStorageError("LOCKED", "This budget month is locked.");
      }
      if ((existing?.month.revision ?? 0) !== document.month.revision) {
        throw new BudgetStorageError(
          "CONFLICT",
          "This budget month has changed. Reload it before saving again.",
        );
      }
      if (existing && existing.month.createdAt !== document.month.createdAt) {
        throw new BudgetStorageError(
          "INVALID_DATA",
          "A saved month's creation date cannot change.",
        );
      }
      if (document.month.revision === Number.MAX_SAFE_INTEGER) {
        throw new BudgetStorageError(
          "INVALID_DATA",
          "The month revision cannot be increased further.",
        );
      }
      const otherMonths = snapshot.months.filter(
        (item) => item.month.id !== document.month.id,
      );
      if (
        otherMonths.some(
          (item) =>
            item.month.year === document.month.year &&
            item.month.month === document.month.month,
        )
      ) {
        throw new BudgetStorageError(
          "DUPLICATE_MONTH",
          "A budget already exists for this month.",
        );
      }
      const groupIds = new Set(
        otherMonths.flatMap((item) => item.groups.map((group) => group.id)),
      );
      const rowIds = new Set(
        otherMonths.flatMap((item) => item.rows.map((row) => row.id)),
      );
      if (
        document.groups.some((group) => groupIds.has(group.id)) ||
        document.rows.some((row) => rowIds.has(row.id))
      ) {
        throw new BudgetStorageError(
          "FOREIGN_ID",
          "A group or row belongs to another budget month.",
        );
      }
      const saved = sortDocument(clone(document));
      if (
        inputSnapshot &&
        !saved.rows.some((row) => row.id === inputSnapshot.budgetRowId)
      )
        throw new BudgetStorageError(
          "INVALID_DATA",
          "The salary row does not belong to this month.",
        );
      saved.month.revision += 1;
      saved.month.updatedAt = new Date().toISOString();
      snapshot.months = [...otherMonths, saved];
      const retainedRowIds = new Set(
        snapshot.months.flatMap((item) => item.rows.map((row) => row.id)),
      );
      snapshot.paySnapshots = (snapshot.paySnapshots ?? []).filter((item) =>
        retainedRowIds.has(item.budgetRowId),
      );
      if (inputSnapshot)
        if (
          (snapshot.paySnapshots ?? []).some(
            (item) => item.id === inputSnapshot.id,
          )
        )
          throw new BudgetStorageError(
            "INVALID_DATA",
            "A pay estimate snapshot with this identifier already exists.",
          );
      if (inputSnapshot)
        snapshot.paySnapshots = [
          ...(snapshot.paySnapshots ?? []),
          clone(inputSnapshot),
        ];
      write(snapshot);
      return saved;
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
      const snapshot = read();
      const saved = snapshot.months.find((item) => item.month.id === id);
      if (!saved)
        throw new BudgetStorageError(
          "NOT_FOUND",
          "This month no longer exists.",
        );
      if (saved.month.revision !== revision)
        throw new BudgetStorageError(
          "CONFLICT",
          "This month has changed. Reload it before changing its lock.",
        );
      saved.month.isLocked = locked;
      saved.month.revision += 1;
      saved.month.updatedAt = new Date().toISOString();
      write(snapshot);
      return sortDocument(saved);
    },
    async listTemplates() {
      return read().templates.sort(
        (a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||
          compareId(a, b),
      );
    },
    async loadTemplate(id) {
      assertId(id);
      return read().templates.find((template) => template.id === id) ?? null;
    },
    async saveTemplate(template) {
      assertValidTemplate(template);
      const snapshot = read();
      const existing = snapshot.templates.find(
        (item) => item.id === template.id,
      );
      if (
        existing &&
        (existing.createdAt !== template.createdAt ||
          existing.updatedAt !== template.updatedAt)
      ) {
        throw new BudgetStorageError(
          "CONFLICT",
          "This template has changed. Reload it before saving again.",
        );
      }
      const saved = clone(template);
      saved.updatedAt = new Date(
        Math.max(Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0),
      ).toISOString();
      snapshot.templates = [
        ...snapshot.templates.filter((item) => item.id !== saved.id),
        saved,
      ];
      write(snapshot);
      return saved;
    },
    async getPayProfile() {
      return read().payProfile ?? null;
    },
    async savePayProfile(input) {
      validatePayProfile(input);
      const snapshot = read();
      const saved = { ...clone(input), updatedAt: new Date().toISOString() };
      snapshot.payProfile = saved;
      write(snapshot);
      return saved;
    },
    async getSelectedMonthId() {
      return read().selectedMonthId;
    },
    async setSelectedMonthId(id) {
      assertId(id);
      const snapshot = read();
      if (!snapshot.months.some((item) => item.month.id === id)) {
        throw new BudgetStorageError(
          "NOT_FOUND",
          "The selected budget month does not exist.",
        );
      }
      snapshot.selectedMonthId = id;
      write(snapshot);
    },
  };
}
