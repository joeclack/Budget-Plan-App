import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Money } from "@/components/money";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type SectionCardProps = PropsWithChildren<{
  emphasizedHeader?: boolean;
  subtitle?: string;
  title: string;
  total?: number;
  totalContent?: ReactNode;
}>;

export function SectionCard({
  children,
  emphasizedHeader = false,
  subtitle,
  title,
  total,
  totalContent,
}: SectionCardProps) {
  const colors = useAppColors();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.header,
          emphasizedHeader && [
            styles.emphasizedHeader,
            { borderBottomColor: colors.separator },
          ],
        ]}
      >
        <View style={styles.headerCopy}>
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              emphasizedHeader && styles.emphasizedTitle,
              { color: colors.text },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {totalContent ?? (total !== undefined ? <Money value={total} /> : null)}
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
  emphasizedHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xs,
    paddingBottom: spacing.md,
  },
  emphasizedTitle: { fontSize: 19, fontWeight: "700", lineHeight: 24 },
  subtitle: typography.caption,
});
