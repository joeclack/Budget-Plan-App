import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { HeaderIconMenuProps } from "@/components/header-icon-menu-types";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type Anchor = { x: number; y: number; width: number; height: number };

export function HeaderIconMenu({
  accessibilityLabel,
  disabled = false,
  options,
  systemImage,
}: HeaderIconMenuProps) {
  const colors = useAppColors();
  const buttonRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
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

  function close() {
    setAnchor(null);
  }

  function present() {
    if (disabled) return;
    const node = buttonRef.current;
    if (!node) return;

    // Defer the overlay until after this click finishes. On web, mounting a
    // full-screen backdrop in the same event lets that click dismiss the menu.
    const open = (next: Anchor) => {
      requestAnimationFrame(() => setAnchor(next));
    };

    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        open({ x, y, width, height });
        return;
      }
      requestAnimationFrame(() => {
        node.measureInWindow((nextX, nextY, nextWidth, nextHeight) => {
          open({
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
          });
        });
      });
    });
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

  const menuWidth = 248;
  const menuTop = anchor ? anchor.y + anchor.height + 8 : 0;
  const menuLeft = anchor
    ? Math.max(
        spacing.md,
        Math.min(
          anchor.x + anchor.width - menuWidth,
          windowWidth - menuWidth - spacing.md,
        ),
      )
    : 0;
  const openDown = !anchor || menuTop + 220 < windowHeight - spacing.xl;

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: Boolean(anchor) }}
        collapsable={false}
        disabled={disabled}
        hitSlop={8}
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
            isInteractive={false}
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
      {anchor ? (
        <Modal animationType="fade" transparent visible onRequestClose={close}>
          <Pressable style={styles.backdrop} onPress={close}>
            <View
              style={[
                styles.menu,
                {
                  left: menuLeft,
                  top: openDown ? menuTop : undefined,
                  bottom: openDown ? undefined : windowHeight - anchor.y + 8,
                  width: menuWidth,
                  borderColor: colors.border,
                },
                !supportsGlass && { backgroundColor: colors.surface },
              ]}
            >
              {supportsGlass ? (
                <GlassView
                  colorScheme="auto"
                  glassEffectStyle="regular"
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              {options.map((option) => (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.selected }}
                  onPress={() => {
                    close();
                    option.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && styles.pressed,
                  ]}
                >
                  {option.systemImage ? (
                    <SymbolView
                      fallback={null}
                      name={option.systemImage}
                      size={16}
                      tintColor={colors.accent}
                      weight="medium"
                    />
                  ) : null}
                  <Text
                    style={[
                      typography.headline,
                      styles.optionLabel,
                      { color: colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.selected ? (
                    <SymbolView
                      fallback={<Text style={{ color: colors.accent }}>✓</Text>}
                      name="checkmark"
                      size={14}
                      tintColor={colors.accent}
                      weight="semibold"
                    />
                  ) : (
                    <View style={styles.checkmarkSpacer} />
                  )}
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
  backdrop: { flex: 1 },
  menu: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingVertical: spacing.xs,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  option: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  optionLabel: { flex: 1 },
  checkmarkSpacer: { width: 14 },
});
