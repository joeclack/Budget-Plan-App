import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { useAppColors } from "@/theme/tokens";

const buttonSize = 36;

export function GlassIconButton({
  accessibilityLabel,
  disabled = false,
  onPress,
  systemImage,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
  systemImage: SFSymbol;
}) {
  const colors = useAppColors();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );
    return () => subscription.remove();
  }, []);

  const supportsGlass =
    Platform.OS === "ios" && !reduceTransparency && isGlassEffectAPIAvailable();
  const icon = (
    <SymbolView
      fallback={<Text style={{ color: colors.accent }}>•</Text>}
      name={systemImage}
      size={16}
      tintColor={colors.accent}
      weight="semibold"
    />
  );

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {supportsGlass ? (
        <GlassView
          colorScheme="auto"
          glassEffectStyle="regular"
          isInteractive={!disabled}
          style={styles.surface}
        >
          {icon}
        </GlassView>
      ) : (
        <View
          style={[
            styles.surface,
            styles.fallback,
            {
              backgroundColor: colors.control,
              borderColor: colors.controlBorder,
            },
          ]}
        >
          {icon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: buttonSize / 2 },
  surface: {
    alignItems: "center",
    borderRadius: buttonSize / 2,
    height: buttonSize,
    justifyContent: "center",
    width: buttonSize,
  },
  fallback: { borderWidth: 1 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.55 },
});
