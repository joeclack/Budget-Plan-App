import { HeaderIconMenu } from "@/components/header-icon-menu";
import {
  groupSortActions,
  type GroupMenuProps,
} from "@/components/group-menu-types";

export function GroupMenu({
  busy,
  canEdit,
  groupTitle,
  onAddRow,
  onEditGroup,
  onSort,
  sort,
}: GroupMenuProps) {
  return (
    <HeaderIconMenu
      accessibilityLabel={`${groupTitle} options`}
      disabled={busy}
      systemImage="ellipsis.circle"
      options={[
        ...(canEdit
          ? [
              { label: "Add row", systemImage: "plus" as const, onPress: onAddRow },
              {
                label: "Edit group",
                systemImage: "pencil" as const,
                onPress: onEditGroup,
              },
            ]
          : []),
        ...groupSortActions.map((action) => ({
          label: action.label,
          selected: action.value === sort,
          systemImage: action.systemImage,
          onPress: () => onSort(action.value),
        })),
      ]}
    />
  );
}
