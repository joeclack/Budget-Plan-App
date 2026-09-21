import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type HeaderIconMenuOption = {
  label: string;
  onPress: () => void;
};

type HeaderIconMenuProps = {
  accessibilityLabel: string;
  disabled?: boolean;
  options: HeaderIconMenuOption[];
  systemImage: "arrow.up.arrow.down" | "ellipsis.circle";
};

export function HeaderIconMenu({
  accessibilityLabel,
  disabled = false,
  options,
  systemImage,
}: HeaderIconMenuProps) {
  const colors = useAppColors();
  const [open, setOpen] = useState(false);
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

  function present() {
    if (disabled) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: options.length,
          options: [...options.map((option) => option.label), "Cancel"],
        },
        (index) => {
          if (index != null && index < options.length) options[index].onPress();
        },
      );
      return;
    }
    setOpen(true);
  }

  const icon = (
    <SymbolView
      fallback={
        <Text style={{ color: colors.accent }}>
          {systemImage === "ellipsis.circle" ? "•••" : "↕"}
        </Text>
      }
      name={systemImage}
      size={16}
      tintColor={colors.accent}
      weight="semibold"
    />
  );

  return (
    <>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={present}
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
      {open ? (
        <Modal
          animationType="fade"
          transparent
          visible
          onRequestClose={() => setOpen(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View
              style={[
                styles.sheet,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {options.map((option) => (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  onPress={() => {
                    setOpen(false);
                    option.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[typography.headline, { color: colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: radius.pill },
  surface: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  fallback: { borderWidth: 1 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.55 },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.28)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: spacing.xs,
  },
  option: {
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
});
