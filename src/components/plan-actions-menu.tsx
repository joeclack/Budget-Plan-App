import { Button, Host, Menu } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  menuIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "react-native";

import { useAppColors } from "@/theme/tokens";

type PlanActionsMenuProps = {
  busy: boolean;
  canArrange: boolean;
  isLocked: boolean;
  onAddGroup: () => void;
  onArrange: () => void;
  onToggleLock: () => void;
};

export function PlanActionsMenu({
  busy,
  canArrange,
  isLocked,
  onAddGroup,
  onArrange,
  onToggleLock,
}: PlanActionsMenuProps) {
  const colors = useAppColors();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const editingDisabled = busy || isLocked;

  return (
    <Host matchContents colorScheme={colorScheme} seedColor={colors.accent}>
      <Menu
        label="Actions"
        modifiers={[
          buttonStyle("glass"),
          buttonBorderShape("capsule"),
          controlSize("small"),
          menuIndicator("visible"),
          disabled(busy),
        ]}
      >
        <Button
          label="Add group"
          modifiers={[disabled(editingDisabled)]}
          systemImage="plus"
          onPress={onAddGroup}
        />
        <Button
          label="Arrange groups"
          modifiers={[disabled(editingDisabled || !canArrange)]}
          systemImage="arrow.up.arrow.down"
          onPress={onArrange}
        />
        <Button
          label={isLocked ? "Unlock month" : "Lock month"}
          modifiers={[disabled(busy)]}
          systemImage={isLocked ? "lock.open" : "lock"}
          onPress={onToggleLock}
        />
      </Menu>
    </Host>
  );
}
