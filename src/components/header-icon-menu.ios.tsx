import { Host } from "@expo/ui";
import { Button, Menu, Toggle } from "@expo/ui/swift-ui";
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

import type { HeaderIconMenuProps } from "@/components/header-icon-menu-types";
import { useAppColors } from "@/theme/tokens";

const menuSize = 36;

export function HeaderIconMenu({
  accessibilityLabel,
  disabled: isDisabled = false,
  options,
  systemImage,
}: HeaderIconMenuProps) {
  const colors = useAppColors();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

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
          label={accessibilityLabel}
          modifiers={[
            buttonStyle("glass"),
            buttonBorderShape("capsule"),
            controlSize("small"),
            labelStyle("iconOnly"),
            menuIndicator("hidden"),
            disabled(isDisabled),
            contentShape(shapes.rectangle()),
          ]}
          systemImage={systemImage}
        >
          {options.map((option) =>
            option.selected !== undefined ? (
              <Toggle
                key={option.label}
                isOn={option.selected}
                label={option.label}
                onIsOnChange={() => option.onPress()}
                systemImage={option.systemImage}
              />
            ) : (
              <Button
                key={option.label}
                label={option.label}
                onPress={option.onPress}
                systemImage={option.systemImage}
              />
            ),
          )}
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
