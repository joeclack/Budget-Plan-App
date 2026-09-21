import { Host } from "@expo/ui";
import {
  Button,
  ControlGroup,
  Menu,
  Section,
  Toggle,
} from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  contentShape,
  controlSize,
  disabled,
  labelStyle,
  menuIndicator,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, useColorScheme, View } from "react-native";

import {
  groupSortActions,
  type GroupMenuProps,
} from "@/components/group-menu-types";
import { useAppColors } from "@/theme/tokens";

const menuSize = 36;

export function GroupMenu({
  busy,
  canEdit,
  groupTitle,
  onAddRow,
  onEditGroup,
  onSort,
  sort,
}: GroupMenuProps) {
  const colors = useAppColors();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const editingDisabled = busy || !canEdit;

  return (
    <View collapsable={false} style={styles.slot}>
      <Host
        colorScheme={colorScheme}
        ignoreSafeArea="all"
        matchContents
        seedColor={colors.accent}
        style={styles.slot}
      >
        <Menu
          label={`${groupTitle} options`}
          modifiers={[
            buttonStyle("glass"),
            buttonBorderShape("capsule"),
            controlSize("small"),
            labelStyle("iconOnly"),
            menuIndicator("hidden"),
            disabled(busy),
            contentShape(shapes.rectangle()),
          ]}
          systemImage="ellipsis.circle"
        >
          <ControlGroup>
            <Button
              label="Add"
              modifiers={[disabled(editingDisabled)]}
              systemImage="plus"
              onPress={onAddRow}
            />
            <Button
              label="Edit"
              modifiers={[disabled(editingDisabled)]}
              systemImage="pencil"
              onPress={onEditGroup}
            />
          </ControlGroup>
          <Section title="Sort">
            {groupSortActions.map((action) => (
              <Toggle
                key={action.value}
                isOn={action.value === sort}
                label={action.label}
                systemImage={action.systemImage}
                onIsOnChange={() => onSort(action.value)}
              />
            ))}
          </Section>
        </Menu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: menuSize,
    width: menuSize,
  },
});
