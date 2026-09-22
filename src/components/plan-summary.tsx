import { Host, Switch } from "@expo/ui";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { BudgetAmount } from "@/components/budget-amount";
import { hasRecordedActuals } from "@/domain/budget";
import type { AmountResult, BudgetEvaluation } from "@/domain/budget/types";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

const PERFORATIONS = Array.from({ length: 18 }, (_, index) => index);

export function PlanSummary({
  evaluation,
  headline,
  spendingToggle,
}: {
  evaluation: BudgetEvaluation;
  headline: { label: string; result: AmountResult };
  spendingToggle?: {
    disabled: boolean;
    enabled: boolean;
    onValueChange: (enabled: boolean) => void;
  } | null;
}) {
  const colors = useAppColors();
  const meter = allocationMeter(evaluation);
  const percent = meter ? Math.round(Math.min(meter.ratio, 1) * 100) : 0;

  return (
    <View accessibilityLabel="Budget summary" style={styles.card}>
      <LinearGradient
        colors={colors.heroGradient}
        dither
        end={{ x: 1, y: 1 }}
        locations={[0, 0.46, 1]}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={colors.heroSheen}
        end={{ x: 0.85, y: 0.7 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.mark}>
        <View
          style={[
            styles.ring,
            styles.ringOuter,
            { borderColor: colors.heroRing },
          ]}
        />
        <View
          style={[
            styles.ring,
            styles.ringInner,
            { borderColor: colors.heroRing },
          ]}
        />
      </View>

      <View style={styles.face}>
        <View style={styles.headline}>
          <Text style={[styles.kicker, { color: colors.heroSecondaryText }]}>
            {headline.label}
          </Text>
          <BudgetAmount result={headline.result} variant="hero" />
        </View>
        {meter ? (
          <View
            accessibilityLabel={
              meter.over
                ? "Allocated more than income"
                : `${percent} percent of income is planned`
            }
            style={styles.meter}
          >
            <View style={styles.meterLabels}>
              <Text
                style={[styles.meterLabel, { color: colors.heroSecondaryText }]}
              >
                Of income
              </Text>
              <Text
                style={[styles.meterLabel, { color: colors.heroSecondaryText }]}
              >
                {meter.over ? "Over planned" : `${percent}% planned`}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.heroTrack }]}>
              <LinearGradient
                colors={meter.over ? colors.heroOverFill : colors.heroFill}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={[styles.fill, { width: `${percent}%` }]}
              />
            </View>
          </View>
        ) : null}
        {spendingToggle ? (
          <Host
            colorScheme="dark"
            ignoreSafeArea="all"
            matchContents={{ vertical: true }}
            seedColor={colors.accent}
            style={styles.spendingToggle}
          >
            <Switch
              disabled={spendingToggle.disabled}
              label="Spending"
              value={spendingToggle.enabled}
              onValueChange={spendingToggle.onValueChange}
            />
          </Host>
        ) : null}
      </View>

      <View style={styles.seam}>
        <View style={styles.perforation}>
          {PERFORATIONS.map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: colors.heroSecondaryText },
              ]}
            />
          ))}
        </View>
        <View
          style={[
            styles.notch,
            styles.notchLeft,
            { backgroundColor: colors.background },
          ]}
        />
        <View
          style={[
            styles.notch,
            styles.notchRight,
            { backgroundColor: colors.background },
          ]}
        />
      </View>

      <View style={[styles.stub, { backgroundColor: colors.heroStub }]}>
        <View style={styles.breakdown}>
          <SummaryItem label="Income" result={evaluation.income} />
          <View
            style={[styles.divider, { backgroundColor: colors.heroDivider }]}
          />
          <SummaryItem label="Allocated" result={evaluation.allocated} />
        </View>
        {hasRecordedActuals(evaluation) ? (
          <View
            style={[styles.leftover, { borderTopColor: colors.heroDivider }]}
          >
            <SummaryItem
              label="Recorded leftover"
              result={evaluation.leftUnspent}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function allocationMeter(evaluation: BudgetEvaluation) {
  if (!evaluation.income.ok || !evaluation.allocated.ok) return null;
  const income = evaluation.income.amountMinor;
  const allocated = evaluation.allocated.amountMinor;
  if (income <= 0 || allocated < 0) return null;
  return { over: allocated > income, ratio: allocated / income };
}

function SummaryItem({
  label,
  result,
}: {
  label: string;
  result: AmountResult;
}) {
  const colors = useAppColors();
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryLabel, { color: colors.heroSecondaryText }]}>
        {label}
      </Text>
      <BudgetAmount result={result} variant="heroSmall" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: radius.xl,
    boxShadow: "0 16px 32px rgba(6, 20, 48, 0.28)",
    overflow: "hidden",
  },
  mark: {
    height: 168,
    position: "absolute",
    right: -46,
    top: -58,
    width: 168,
  },
  ring: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    position: "absolute",
  },
  ringOuter: { height: 168, width: 168 },
  ringInner: { height: 108, left: 30, top: 30, width: 108 },
  face: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headline: { gap: spacing.xs, paddingRight: 56 },
  kicker: typography.caption,
  meter: { gap: spacing.sm, marginTop: spacing.xs },
  meterLabels: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meterLabel: typography.caption,
  spendingToggle: { marginTop: spacing.xs, width: "100%" },
  track: {
    borderRadius: radius.pill,
    height: 8,
    overflow: "hidden",
  },
  fill: { borderRadius: radius.pill, height: "100%" },
  seam: {
    height: 22,
    justifyContent: "center",
  },
  perforation: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
  },
  dot: { borderRadius: 2, height: 4, opacity: 0.7, width: 4 },
  notch: {
    borderRadius: 12,
    height: 24,
    position: "absolute",
    top: -1,
    width: 24,
  },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  stub: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  breakdown: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  summaryItem: { flex: 1, gap: 3 },
  summaryLabel: typography.caption,
  divider: { height: 32, width: StyleSheet.hairlineWidth },
  leftover: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
});
