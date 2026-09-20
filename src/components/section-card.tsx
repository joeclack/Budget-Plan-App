import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Money } from "@/components/money";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type SectionCardProps = PropsWithChildren<{
  subtitle?: string;
  title: string;
  total: number;
}>;

export function SectionCard({
  children,
  subtitle,
  title,
  total,
}: SectionCardProps) {
  const colors = useAppColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Money value={total} />
      </View>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  headerCopy: { flex: 1, gap: 2, paddingRight: spacing.md },
  title: typography.headline,
  subtitle: typography.caption,
});
