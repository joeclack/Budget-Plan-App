import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GlassButton } from "@/components/glass-button";
import { Money } from "@/components/money";
import { PreviewEditSheet } from "@/components/preview-edit-sheet";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";
import { sampleBudget } from "@/data/sample-budget";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

export default function BudgetScreen() {
  const colors = useAppColors();
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [previewGroups, setPreviewGroups] = useState<string[]>([]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.headingBlock}>
          <Text style={[styles.eyebrow, { color: colors.secondaryText }]}>
            MONTHLY PLAN
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            September 2026
          </Text>
        </View>
        <GlassButton
          accessibilityLabel="Choose budget month"
          label="Sep 2026"
        />
      </View>

      <View
        accessibilityLabel="Budget summary"
        style={[
          styles.summary,
          { backgroundColor: colors.hero, borderColor: colors.heroBorder },
        ]}
      >
        <Text
          style={[styles.summaryLabel, { color: colors.heroSecondaryText }]}
        >
          Left to plan
        </Text>
        <Money value={sampleBudget.leftToPlan} variant="hero" />
        <View style={styles.summaryBreakdown}>
          <SummaryItem label="Income" value={sampleBudget.income} />
          <View
            style={[styles.divider, { backgroundColor: colors.heroBorder }]}
          />
          <SummaryItem label="Allocated" value={sampleBudget.allocated} />
        </View>
      </View>

      <View style={styles.sectionHeading}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionTitle, { color: colors.text }]}
        >
          Your plan
        </Text>
        <GlassButton
          accessibilityLabel="Add a budget group"
          compact
          label="Add"
          onPress={() => setIsAddGroupOpen(true)}
        />
      </View>

      {sampleBudget.groups.map((group) => (
        <SectionCard
          key={group.id}
          subtitle={group.subtitle}
          title={group.title}
          total={group.total}
        >
          {group.rows.map((row, index) => (
            <View
              key={row.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopColor: colors.separator,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>
                  {row.label}
                </Text>
                {row.detail ? (
                  <Text
                    style={[styles.rowDetail, { color: colors.secondaryText }]}
                  >
                    {row.detail}
                  </Text>
                ) : null}
              </View>
              <Money value={row.amount} />
            </View>
          ))}
        </SectionCard>
      ))}

      {previewGroups.map((groupName, index) => (
        <SectionCard key={`${groupName}-${index}`} title={groupName} total={0}>
          <Text style={[styles.emptyGroup, { color: colors.secondaryText }]}>
            Ready for budget rows in Milestone 2.
          </Text>
        </SectionCard>
      ))}

      <Text style={[styles.footnote, { color: colors.secondaryText }]}>
        Sample data for the Milestone 1 device preview.
      </Text>

      <PreviewEditSheet
        onClose={() => setIsAddGroupOpen(false)}
        onSave={(name) => {
          setPreviewGroups((groups) => [...groups, name]);
          setIsAddGroupOpen(false);
        }}
        visible={isAddGroupOpen}
      />
    </Screen>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  const colors = useAppColors();

  return (
    <View style={styles.summaryItem}>
      <Text
        style={[styles.summaryItemLabel, { color: colors.heroSecondaryText }]}
      >
        {label}
      </Text>
      <Money value={value} variant="heroSmall" />
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
  summary: {
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: "hidden",
    padding: spacing.lg,
  },
  summaryLabel: typography.caption,
  summaryBreakdown: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  summaryItem: { flex: 1, gap: 3 },
  summaryItemLabel: typography.caption,
  divider: { height: 32, width: StyleSheet.hairlineWidth },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  sectionTitle: typography.title2,
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  rowCopy: { flex: 1, gap: 3, paddingRight: spacing.md },
  rowLabel: typography.body,
  rowDetail: typography.caption,
  footnote: { ...typography.caption, textAlign: "center" },
  emptyGroup: { ...typography.body, paddingVertical: spacing.md },
});
