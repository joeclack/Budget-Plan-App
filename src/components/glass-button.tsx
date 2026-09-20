import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type GlassButtonProps = {
  accessibilityLabel: string;
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  prominent?: boolean;
};

export function GlassButton({
  accessibilityLabel,
  compact = false,
  disabled = false,
  label,
  onPress,
  prominent = false,
}: GlassButtonProps) {
  const colors = useAppColors();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => subscription.remove();
  }, []);

  const supportsGlass =
    Platform.OS === "ios" && !reduceTransparency && isGlassEffectAPIAvailable();
  const content = (
    <Text
      style={[
        compact ? styles.compactLabel : styles.label,
        { color: prominent ? colors.buttonText : colors.accent },
        disabled && styles.disabledText,
      ]}
    >
      {label}
    </Text>
  );

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        compact && styles.compactPressable,
        prominent && styles.prominent,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {supportsGlass ? (
        <GlassView
          colorScheme="auto"
          glassEffectStyle="regular"
          isInteractive={!disabled}
          style={[styles.surface, compact && styles.compactSurface]}
          tintColor={prominent ? colors.accent : undefined}
        >
          {content}
        </GlassView>
      ) : (
        <View
          style={[
            styles.surface,
            compact && styles.compactSurface,
            {
              backgroundColor: prominent ? colors.accent : colors.control,
              borderColor: prominent ? colors.accent : colors.controlBorder,
            },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: radius.pill },
  compactPressable: { alignSelf: "auto" },
  surface: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compactSurface: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  prominent: { width: "100%" },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.55 },
  label: typography.headline,
  compactLabel: typography.callout,
  disabledText: { opacity: 0.85 },
});
