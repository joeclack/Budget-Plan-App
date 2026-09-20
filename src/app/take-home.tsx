import { StyleSheet, Text, View } from "react-native";

import { GlassButton } from "@/components/glass-button";
import { Money } from "@/components/money";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

const preview = {
  annualSalary: 48000,
  monthlyGross: 4000,
  incomeTax: 590,
  nationalInsurance: 236.64,
  pension: 200,
  takeHome: 2973.36,
};

export default function TakeHomeScreen() {
  const colors = useAppColors();

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headingBlock}>
          <Text style={[styles.eyebrow, { color: colors.secondaryText }]}>
            PAY ESTIMATE
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            Take-home
          </Text>
        </View>
        <GlassButton
          accessibilityLabel="Open take-home settings"
          label="Settings"
        />
      </View>

      <View
        style={[
          styles.takeHomeCard,
          { backgroundColor: colors.hero, borderColor: colors.heroBorder },
        ]}
      >
        <Text
          style={[styles.takeHomeLabel, { color: colors.heroSecondaryText }]}
        >
          Estimated monthly pay
        </Text>
        <Money value={preview.takeHome} variant="hero" />
        <Text style={[styles.assumption, { color: colors.heroSecondaryText }]}>
          England · Standard allowance · Monthly pay
        </Text>
      </View>

      <SectionCard
        subtitle="Example input"
        title="Annual salary"
        total={preview.annualSalary}
      >
        <DetailRow label="Gross each month" value={preview.monthlyGross} />
        <DetailRow label="Income tax" negative value={preview.incomeTax} />
        <DetailRow
          label="National Insurance"
          negative
          value={preview.nationalInsurance}
        />
        <DetailRow
          label="Pension · 5% of whole salary"
          negative
          value={preview.pension}
        />
      </SectionCard>

      <View
        style={[
          styles.note,
          {
            backgroundColor: colors.accentSoft,
            borderColor: colors.accentBorder,
          },
        ]}
      >
        <Text style={[styles.noteTitle, { color: colors.text }]}>
          Calculator arrives in Milestone 4
        </Text>
        <Text style={[styles.noteCopy, { color: colors.secondaryText }]}>
          This screen is a design preview. These figures are sample data and are
          not yet a personal payroll calculation.
        </Text>
      </View>

      <GlassButton
        accessibilityLabel="Use estimated pay in a monthly budget"
        disabled
        label="Use in monthly budget"
        prominent
      />
    </Screen>
  );
}

function DetailRow({
  label,
  negative = false,
  value,
}: {
  label: string;
  negative?: boolean;
  value: number;
}) {
  const colors = useAppColors();

  return (
    <View style={[styles.detailRow, { borderTopColor: colors.separator }]}>
      <Text style={[styles.detailLabel, { color: colors.text }]}>{label}</Text>
      <Money prefix={negative ? "−" : undefined} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headingBlock: { flex: 1 },
  eyebrow: { ...typography.eyebrow, marginBottom: spacing.xs },
  title: typography.largeTitle,
  takeHomeCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  takeHomeLabel: typography.caption,
  assumption: typography.caption,
  detailRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
  },
  detailLabel: { ...typography.body, flex: 1, paddingRight: spacing.md },
  note: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noteTitle: typography.headline,
  noteCopy: { ...typography.callout, lineHeight: 21 },
});
