import type { GroupRowSort } from "@/domain/budget";

export const groupSortActions = [
  {
    value: "planned" as const,
    label: "Planned order",
    systemImage: "list.bullet",
  },
  {
    value: "amountAsc" as const,
    label: "Amount, low to high",
    systemImage: "arrow.up",
  },
  {
    value: "amountDesc" as const,
    label: "Amount, high to low",
    systemImage: "arrow.down",
  },
  { value: "date" as const, label: "Payment date", systemImage: "calendar" },
] as const;

export type GroupMenuProps = {
  busy: boolean;
  canEdit: boolean;
  groupTitle: string;
  onAddRow: () => void;
  onEditGroup: () => void;
  onSort: (sort: GroupRowSort) => void;
  sort: GroupRowSort;
};
