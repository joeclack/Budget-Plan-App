import { Button, Host } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  labelStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAppColors } from "@/theme/tokens";

export function GlassIconButton({
  accessibilityLabel,
  disabled: isDisabled = false,
  onPress,
  systemImage,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  systemImage: SFSymbol;
}) {
  const colors = useAppColors();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <Host
      colorScheme={colorScheme}
      ignoreSafeArea="all"
      matchContents
      seedColor={colors.accent}
    >
      <Button
        label={accessibilityLabel}
        modifiers={[
          buttonStyle("glass"),
          controlSize("extraLarge"),
          labelStyle("iconOnly"),
          buttonBorderShape("circle"),
          disabled(isDisabled),
        ]}
        onPress={onPress}
        systemImage={systemImage}
      />
    </Host>
  );
}
