import { HeaderIconMenu } from "@/components/header-icon-menu";

type GroupActionsMenuProps = {
  busy: boolean;
  groupTitle: string;
  onAddRow: () => void;
  onEditGroup: () => void;
};

export function GroupActionsMenu({
  busy,
  groupTitle,
  onAddRow,
  onEditGroup,
}: GroupActionsMenuProps) {
  return (
    <HeaderIconMenu
      accessibilityLabel={`Edit ${groupTitle}`}
      disabled={busy}
      systemImage="ellipsis.circle"
      options={[
        { label: "Add row", onPress: onAddRow },
        { label: "Edit group", onPress: onEditGroup },
      ]}
    />
  );
}
