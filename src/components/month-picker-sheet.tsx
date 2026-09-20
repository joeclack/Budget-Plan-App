import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type MonthPickerSheetProps = {
  month: number;
  onClose: () => void;
  onSelect: (year: number, month: number) => void;
  year: number;
};

export function MonthPickerSheet({
  month,
  onClose,
  onSelect,
  year,
}: MonthPickerSheetProps) {
  const colors = useAppColors();
  const [displayYear, setDisplayYear] = useState(year);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent={Platform.OS !== "ios"}
      visible
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[
          styles.root,
          { backgroundColor: colors.surface },
          Platform.OS !== "ios" && styles.fallbackRoot,
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.secondaryText }]}>
              BUDGET MONTH
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Choose a month
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.close, { color: colors.accent }]}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.yearRow}>
          <YearButton
            direction="left"
            label="Previous year"
            onPress={() => setDisplayYear((value) => value - 1)}
          />
          <Text style={[styles.year, { color: colors.text }]}>
            {displayYear}
          </Text>
          <YearButton
            direction="right"
            label="Next year"
            onPress={() => setDisplayYear((value) => value + 1)}
          />
        </View>

        <View style={styles.monthGrid}>
          {months.map((name, index) => {
            const selected = displayYear === year && index === month;
            return (
              <View key={name} style={styles.monthCell}>
                <Pressable
                  onPress={() => onSelect(displayYear, index)}
                  style={({ pressed }) => [
                    styles.monthButton,
                    {
                      backgroundColor: selected
                        ? colors.accent
                        : colors.control,
                      borderColor: selected
                        ? colors.accent
                        : colors.controlBorder,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.monthLabel,
                      { color: selected ? colors.buttonText : colors.text },
                    ]}
                  >
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function YearButton({
  direction,
  label,
  onPress,
}: {
  direction: "left" | "right";
  label: string;
  onPress: () => void;
}) {
  const colors = useAppColors();

  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.yearButton,
        { backgroundColor: colors.control },
        pressed && styles.pressed,
      ]}
    >
      <SymbolView
        fallback={
          <Text style={{ color: colors.accent }}>
            {direction === "left" ? "‹" : "›"}
          </Text>
        }
        name={direction === "left" ? "chevron.left" : "chevron.right"}
        size={18}
        tintColor={colors.accent}
        weight="semibold"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.xl, padding: spacing.lg },
  fallbackRoot: { justifyContent: "flex-end" },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: typography.eyebrow,
  title: { ...typography.title2, marginTop: spacing.xs },
  close: typography.callout,
  yearRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  year: typography.title2,
  yearButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  monthCell: { padding: spacing.xs, width: "33.333%" },
  monthButton: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
  },
  monthLabel: typography.headline,
  pressed: { opacity: 0.7 },
});
