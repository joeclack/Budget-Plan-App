import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GlassButton } from "@/components/glass-button";
import { Money } from "@/components/money";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";
import { useBudgetRepository } from "@/db/context";
import { newId, parseMoney, setRowRule } from "@/domain/budget";
import { calculatePay, PAY_LIMIT_MINOR, PAY_RULES } from "@/domain/pay";
import type {
  PayCountry,
  PayEstimate,
  PayEstimateSnapshot,
  PayProfile,
  PensionMethod,
  TaxYear,
} from "@/domain/pay";
import { notifyBudgetChanged } from "@/features/budget/changes";
import {
  Action,
  Choices,
  EditorSheet,
  Field,
  Heading,
  Note,
} from "@/features/budget/editor-controls";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

const taxYears: { value: TaxYear; label: string }[] = [
  { value: "2026/27", label: "2026/27" },
  { value: "2025/26", label: "2025/26" },
];
const countries: { value: PayCountry; label: string }[] = [
  { value: "england", label: "England" },
  { value: "wales", label: "Wales" },
  { value: "northern_ireland", label: "Northern Ireland" },
];
const pensionMethods: { value: PensionMethod; label: string }[] = [
  { value: "net_pay", label: "Net pay" },
  { value: "relief_at_source", label: "Relief at source" },
  { value: "salary_sacrifice", label: "Salary sacrifice" },
];

function freshProfile(): PayProfile {
  return {
    id: "primary",
    annualSalaryMinor: 0,
    pensionRateBps: 0,
    pensionMethod: "net_pay",
    pensionBasis: "whole_salary",
    country: "england",
    taxYear: "2026/27",
    updatedAt: new Date().toISOString(),
  };
}
function poundsInput(minor: number) {
  return minor
    ? `${Math.trunc(minor / 100)}.${String(minor % 100).padStart(2, "0")}`
    : "";
}
function parseRate(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Enter a pension percentage from 0 to 100, with up to 2 decimal places.",
    );
  const bps = Math.round(Number(value) * 100);
  if (bps > 10_000)
    throw new Error("Pension contribution must be between 0% and 100%.");
  return bps;
}

export default function TakeHomeScreen() {
  const colors = useAppColors();
  const repository = useBudgetRepository();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salary, setSalary] = useState("");
  const [rate, setRate] = useState("0");
  const [method, setMethod] = useState<PensionMethod>("net_pay");
  const [country, setCountry] = useState<PayCountry>("england");
  const [taxYear, setTaxYear] = useState<TaxYear>("2026/27");
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    let active = true;
    repository
      .getPayProfile()
      .then((profile) => {
        if (!active || !profile) return;
        setSalary(poundsInput(profile.annualSalaryMinor));
        setRate(String(profile.pensionRateBps / 100));
        setMethod(profile.pensionMethod);
        setCountry(profile.country);
        setTaxYear(profile.taxYear);
      })
      .catch(
        (reason: unknown) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to open pay settings.",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [repository]);

  const calculation = useMemo(() => {
    try {
      if (!salary.trim()) return { profile: null, estimate: null, error: null };
      const annualSalaryMinor = parseMoney(salary);
      if (annualSalaryMinor > PAY_LIMIT_MINOR)
        throw new Error("Annual salary must be £10,000,000 or less.");
      const profile: PayProfile = {
        ...freshProfile(),
        annualSalaryMinor,
        pensionRateBps: parseRate(rate),
        pensionMethod: method,
        country,
        taxYear,
      };
      return { profile, estimate: calculatePay(profile), error: null };
    } catch (reason) {
      return {
        profile: null,
        estimate: null,
        error:
          reason instanceof Error ? reason.message : "Check the pay details.",
      };
    }
  }, [salary, rate, method, country, taxYear]);

  async function saveProfile() {
    if (!calculation.profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      await repository.savePayProfile(calculation.profile);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save pay settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  const estimate = calculation.estimate;
  return (
    <Screen>
      <View>
        <Text style={[styles.eyebrow, { color: colors.secondaryText }]}>
          PAY ESTIMATE
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>Take-home</Text>
      </View>
      <Field
        label="Annual salary"
        value={salary}
        onChange={setSalary}
        numeric
        disabled={busy}
      />
      <Note>
        Enter £0 to £10,000,000. This assumes one regular monthly job and
        standard PAYE.
      </Note>
      <Field
        label="Pension percentage"
        value={rate}
        onChange={setRate}
        numeric
        disabled={busy}
      />
      <Note>Your contribution is calculated from your whole salary.</Note>
      <Choices
        label="Pension method"
        value={method}
        options={pensionMethods}
        onChange={setMethod}
        disabled={busy}
      />
      <Choices
        label="Tax year"
        value={taxYear}
        options={taxYears}
        onChange={setTaxYear}
        disabled={busy}
      />
      <Choices
        label="Country"
        value={country}
        options={countries}
        onChange={setCountry}
        disabled={busy}
      />
      {calculation.error ? (
        <View
          style={[
            styles.note,
            {
              backgroundColor: colors.accentSoft,
              borderColor: colors.accentBorder,
            },
          ]}
        >
          <Text style={{ color: colors.text }}>{calculation.error}</Text>
        </View>
      ) : null}
      {estimate ? (
        <Estimate estimate={estimate} method={method} />
      ) : (
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
            Enter your salary
          </Text>
          <Text style={{ color: colors.secondaryText }}>
            Your estimate and breakdown will appear here.
          </Text>
        </View>
      )}
      <GlassButton
        accessibilityLabel="Save take-home settings"
        label={busy ? "Saving…" : "Save settings"}
        disabled={busy || !calculation.profile}
        onPress={() => void saveProfile()}
      />
      <GlassButton
        accessibilityLabel="Use estimated pay in a monthly budget"
        label="Use in monthly budget"
        prominent
        disabled={busy || !estimate}
        onPress={() => setApplyOpen(true)}
      />
      <View style={[styles.note, { borderColor: colors.border }]}>
        <Text style={[styles.noteTitle, { color: colors.text }]}>
          What this estimate covers
        </Text>
        <Text style={[styles.noteCopy, { color: colors.secondaryText }]}>
          Standard allowance, monthly pay and employee NI category A in England,
          Wales or Northern Ireland. It excludes student loans, benefits,
          bonuses, other jobs, tax-code adjustments and Scottish tax. Payroll
          rounding can differ by a few pence.
        </Text>
        {method === "relief_at_source" ? (
          <Text style={[styles.noteCopy, { color: colors.secondaryText }]}>
            Relief at source includes the provider’s basic 20% top-up. Extra
            higher-rate relief claimed separately is not added to monthly pay.
          </Text>
        ) : null}
        <Text style={[styles.noteCopy, { color: colors.secondaryText }]}>
          HMRC rules checked {PAY_RULES[taxYear].verifiedAt} ·{" "}
          {PAY_RULES[taxYear].version}
        </Text>
      </View>
      {error ? <Text style={{ color: colors.text }}>{error}</Text> : null}
      {applyOpen && calculation.profile && estimate ? (
        <ApplyEstimateSheet
          profile={calculation.profile}
          estimate={estimate}
          busy={busy}
          setBusy={setBusy}
          onClose={() => setApplyOpen(false)}
        />
      ) : null}
    </Screen>
  );
}

function Estimate({
  estimate,
  method,
}: {
  estimate: PayEstimate;
  method: PensionMethod;
}) {
  const colors = useAppColors();
  return (
    <>
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
        <Money minorValue={estimate.monthlyTakeHomeMinor} variant="hero" />
        <Text style={[styles.assumption, { color: colors.heroSecondaryText }]}>
          Standard allowance · Monthly estimate
        </Text>
      </View>
      <SectionCard
        title="Monthly gross"
        totalContent={<Money minorValue={estimate.monthlyGrossMinor} />}
      >
        <DetailRow label="Income tax" value={estimate.monthlyTaxMinor} />
        <DetailRow
          label="National Insurance"
          value={estimate.monthlyNationalInsuranceMinor}
        />
        <DetailRow
          label={
            method === "relief_at_source" ? "Pension paid by you" : "Pension"
          }
          value={estimate.monthlyPensionDeductionMinor}
        />
        {method === "relief_at_source" ? (
          <DetailRow
            label="Pension reaching pot"
            value={estimate.monthlyPensionGrossMinor}
            negative={false}
          />
        ) : null}
      </SectionCard>
    </>
  );
}

function DetailRow({
  label,
  value,
  negative = true,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  const colors = useAppColors();
  return (
    <View style={[styles.detailRow, { borderTopColor: colors.separator }]}>
      <Text style={[styles.detailLabel, { color: colors.text }]}>{label}</Text>
      <Money prefix={negative ? "−" : undefined} minorValue={value} />
    </View>
  );
}

function ApplyEstimateSheet({
  profile,
  estimate,
  busy,
  setBusy,
  onClose,
}: {
  profile: PayProfile;
  estimate: PayEstimate;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onClose: () => void;
}) {
  const repository = useBudgetRepository();
  const [options, setOptions] = useState<
    { id: string; label: string; monthId: string; rowId: string }[]
  >([]);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    repository
      .listMonths()
      .then(async (months) => {
        const result: {
          id: string;
          label: string;
          monthId: string;
          rowId: string;
        }[] = [];
        for (const month of months) {
          const document = await repository.loadMonth(month.id);
          if (!document || document.month.isLocked) continue;
          const income = new Set(
            document.groups
              .filter((group) => group.classification === "income")
              .map((group) => group.id),
          );
          for (const row of document.rows.filter((item) =>
            income.has(item.groupId),
          ))
            result.push({
              id: `${month.id}:${row.id}`,
              label: `${new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(month.year, month.month - 1, 1))} · ${row.label}`,
              monthId: month.id,
              rowId: row.id,
            });
        }
        if (!active) return;
        setOptions(result);
        setTarget(result[0]?.id ?? "");
      })
      .catch((reason: unknown) => {
        if (active)
          setApplyError(
            reason instanceof Error
              ? reason.message
              : "Unable to load budget rows.",
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [repository]);
  async function apply() {
    const selected = options.find((item) => item.id === target);
    if (!selected || busy) return;
    setBusy(true);
    setApplyError(null);
    try {
      const savedProfile = await repository.savePayProfile(profile);
      const document = await repository.loadMonth(selected.monthId);
      if (!document) throw new Error("That budget month no longer exists.");
      const calculatedAt = new Date().toISOString();
      const result = calculatePay(savedProfile, calculatedAt);
      const snapshot: PayEstimateSnapshot = {
        id: newId(),
        budgetRowId: selected.rowId,
        inputs: savedProfile,
        result,
        rulesetVersion: result.rulesetVersion,
        calculatedAt,
      };
      await repository.saveMonth(
        setRowRule(document, selected.rowId, {
          kind: "fixed",
          amountMinor: result.monthlyTakeHomeMinor,
        }),
        snapshot,
      );
      notifyBudgetChanged();
      onClose();
    } catch (reason) {
      setApplyError(
        reason instanceof Error
          ? reason.message
          : "Unable to update the budget.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorSheet title="Use in monthly budget" busy={busy} onClose={onClose}>
      <Heading>Review the change</Heading>
      <Note>
        This saves a snapshot of this estimate and replaces only the selected
        row in one month. Templates remain unchanged.
      </Note>
      {loading ? (
        <ActivityIndicator />
      ) : options.length ? (
        <Choices
          label="Month and salary row"
          value={target}
          options={options.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
          onChange={setTarget}
          disabled={busy}
        />
      ) : (
        <Note>Create an unlocked budget month with an income row first.</Note>
      )}
      <View style={styles.preview}>
        <Heading>New fixed amount</Heading>
        <Money minorValue={estimate.monthlyTakeHomeMinor} />
      </View>
      <Action
        label={busy ? "Applying…" : "Apply estimate"}
        prominent
        disabled={busy || loading || !target}
        onPress={() => void apply()}
      />
      {applyError ? <Note>{applyError}</Note> : null}
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
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
  preview: { gap: spacing.sm, alignItems: "center", padding: spacing.md },
});
