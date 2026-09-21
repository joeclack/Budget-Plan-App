import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import {
  groupColorLabels,
  groupColors,
  type GroupColor,
} from "@/domain/budget";
import { groupTone } from "@/theme/group-tone";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type GroupColorPickerProps = {
  disabled?: boolean;
  onChange: (color?: GroupColor) => void;
  value?: GroupColor;
};

export function GroupColorPicker({
  disabled = false,
  onChange,
  value,
}: GroupColorPickerProps) {
  const colors = useAppColors();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const tone = groupTone(value, scheme);

  return (
    <View style={styles.block}>
      <Text style={[typography.headline, { color: colors.text }]}>Colour</Text>
      <View style={styles.swatches}>
        <Swatch
          accessibilityLabel="Colour: None"
          borderColor={colors.border}
          disabled={disabled}
          onPress={() => onChange(undefined)}
          selected={!value}
          selectedRing={colors.accent}
        />
        {groupColors.map((color) => {
          const option = groupTone(color, scheme)!;
          return (
            <Swatch
              key={color}
              accessibilityLabel={`Colour: ${groupColorLabels[color]}`}
              borderColor={option.border}
              disabled={disabled}
              onPress={() => onChange(color)}
              selected={value === color}
              selectedRing={colors.accent}
              tone={option}
            />
          );
        })}
      </View>
      {tone ? (
        <LinearGradient
          colors={tone.colors}
          end={tone.end}
          locations={tone.locations}
          start={tone.start}
          style={[styles.preview, { borderColor: tone.border }]}
        >
          <LinearGradient
            colors={tone.sheen}
            end={{ x: 0.85, y: 0.7 }}
            pointerEvents="none"
            start={{ x: 0.15, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.previewLabel, { color: colors.text }]}>
            {groupColorLabels[value!]}
          </Text>
          <Text style={[styles.previewHint, { color: colors.secondaryText }]}>
            Soft wash on this group
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.preview,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.previewLabel, { color: colors.text }]}>
            Default card
          </Text>
          <Text style={[styles.previewHint, { color: colors.secondaryText }]}>
            Uses the ordinary surface
          </Text>
        </View>
      )}
    </View>
  );
}

function Swatch({
  accessibilityLabel,
  borderColor,
  disabled,
  onPress,
  selected,
  selectedRing,
  tone,
}: {
  accessibilityLabel: string;
  borderColor: string;
  disabled: boolean;
  onPress: () => void;
  selected: boolean;
  selectedRing: string;
  tone?: ReturnType<typeof groupTone>;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.swatchRing,
        { borderColor: selected ? selectedRing : "transparent" },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {tone ? (
        <LinearGradient
          colors={tone.colors}
          end={tone.end}
          locations={tone.locations}
          start={tone.start}
          style={[styles.swatch, { borderColor: tone.swatch }]}
        />
      ) : (
        <View style={[styles.swatch, { borderColor }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  swatches: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  swatchRing: {
    borderRadius: radius.pill,
    borderWidth: 2,
    padding: 3,
  },
  swatch: {
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    width: 28,
  },
  preview: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  previewLabel: typography.callout,
  previewHint: typography.caption,
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
});
