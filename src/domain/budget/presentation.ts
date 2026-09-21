import { groupRowSorts, type GroupRowSort } from "./sort";

export type GroupPresentation = {
  collapsed: boolean;
  sort: GroupRowSort;
};

export type GroupPresentationMap = Record<string, GroupPresentation>;

export const defaultGroupPresentation: GroupPresentation = {
  collapsed: false,
  sort: "planned",
};

export function groupPresentationFor(
  map: GroupPresentationMap,
  groupId: string,
): GroupPresentation {
  return map[groupId] ?? defaultGroupPresentation;
}

export function readGroupPresentationMap(value: unknown): GroupPresentationMap {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return {};
  const result: GroupPresentationMap = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!id.trim()) continue;
    const parsed = readGroupPresentation(entry);
    if (parsed) result[id] = parsed;
  }
  return result;
}

function readGroupPresentation(value: unknown): GroupPresentation | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const entry = value as { collapsed?: unknown; sort?: unknown };
  const collapsed = entry.collapsed ?? false;
  const sort = entry.sort ?? "planned";
  if (typeof collapsed !== "boolean") return null;
  if (!groupRowSorts.includes(sort as GroupRowSort)) return null;
  return { collapsed, sort: sort as GroupRowSort };
}
