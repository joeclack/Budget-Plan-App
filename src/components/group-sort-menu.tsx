import { HeaderIconMenu } from "@/components/header-icon-menu";
import type { GroupRowSort } from "@/domain/budget";

const sortActions = [
  { value: "planned" as const, label: "Planned order" },
  { value: "amountAsc" as const, label: "Amount, low to high" },
  { value: "amountDesc" as const, label: "Amount, high to low" },
  { value: "date" as const, label: "Payment date" },
];

type GroupSortMenuProps = {
  onSort: (sort: GroupRowSort) => void;
};

export function GroupSortMenu({ onSort }: GroupSortMenuProps) {
  return (
    <HeaderIconMenu
      accessibilityLabel="Sort"
      systemImage="arrow.up.arrow.down"
      options={sortActions.map((action) => ({
        label: action.label,
        onPress: () => onSort(action.value),
      }))}
    />
  );
}
