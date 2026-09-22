import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GlassButton } from "@/components/glass-button";
import { Money } from "@/components/money";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";
import { useBudgetRepository } from "@/db/context";
import {
  parseMoney,
  setTemplateRowRule,
  type BudgetTemplate,
} from "@/domain/budget";
import { calculatePay, currentTaxYear, PAY_LIMIT_MINOR } from "@/domain/pay";
import type { PayEstimate, PayProfile } from "@/domain/pay";
import {
  notifyBudgetChanged,
  subscribeBudgetChanges,
} from "@/features/budget/changes";
import {
  Action,
  Choices,
  EditorSheet,
  Heading,
  Note,
} from "@/features/budget/editor-controls";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

function freshProfile(): PayProfile {
  return {
    id: "primary",
    annualSalaryMinor: 0,
    pensionRateBps: 0,
    employerPensionRateBps: 0,
    pensionMethod: "net_pay",
    pensionBasis: "whole_salary",
    country: "england",
    taxYear: currentTaxYear(),
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
  const [applyOpen, setApplyOpen] = useState(false);

  function showProfile(profile: PayProfile | null) {
    if (!profile) {
      setSalary("");
      setRate("0");
      return;
    }
    setSalary(poundsInput(profile.annualSalaryMinor));
    setRate(String(profile.pensionRateBps / 100));
  }

  useEffect(() => {
    let active = true;
    repository
      .getPayProfile()
      .then((profile) => {
        if (active) showProfile(profile);
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

  useEffect(
    () =>
      subscribeBudgetChanges(() => {
        void repository.getPayProfile().then(showProfile);
      }),
    [repository],
  );

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
  }, [salary, rate]);

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
      <Screen header="stack">
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  const estimate = calculation.estimate;
  return (
    <Screen header="stack">
      <EstimateHero minorValue={estimate?.monthlyTakeHomeMinor ?? 0} />
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
      <View
        style={[
          styles.inputCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <InputRow
          label="Annual salary"
          value={salary}
          onChange={setSalary}
          disabled={busy}
          first
          placeholder="0.00"
          prefix="£"
        />
        <InputRow
          label="Pension contribution"
          value={rate}
          onChange={setRate}
          disabled={busy}
          placeholder="0"
          suffix="%"
        />
      </View>
      {estimate ? <Estimate estimate={estimate} /> : null}
      <GlassButton
        accessibilityLabel="Save take-home settings"
        label={busy ? "Saving…" : "Save settings"}
        disabled={busy || !calculation.profile}
        onPress={() => void saveProfile()}
      />
      <GlassButton
        accessibilityLabel="Use estimated pay in a budget template"
        label="Use in budget"
        prominent
        disabled={busy || !estimate}
        onPress={() => setApplyOpen(true)}
      />
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

function EstimateHero({ minorValue }: { minorValue: number }) {
  const colors = useAppColors();
  return (
    <View
      style={[
        styles.takeHomeCard,
        { backgroundColor: colors.hero, borderColor: colors.heroBorder },
      ]}
    >
      <Text style={[styles.takeHomeLabel, { color: colors.heroSecondaryText }]}>
        Estimated monthly pay
      </Text>
      <Money minorValue={minorValue} variant="hero" />
    </View>
  );
}

function Estimate({ estimate }: { estimate: PayEstimate }) {
  return (
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
        label="Pension"
        value={estimate.monthlyPensionDeductionMinor}
      />
    </SectionCard>
  );
}

function InputRow({
  label,
  value,
  onChange,
  disabled,
  prefix,
  suffix,
  placeholder,
  first = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  prefix?: string;
  suffix?: string;
  placeholder: string;
  first?: boolean;
}) {
  const colors = useAppColors();
  const inputRef = useRef<TextInput>(null);
  return (
    <Pressable
      accessibilityLabel={`Edit ${label}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => inputRef.current?.focus()}
      style={[
        styles.inputRow,
        { borderTopColor: colors.separator },
        first && styles.firstRow,
      ]}
    >
      <Text style={[styles.detailLabel, { color: colors.text }]}>{label}</Text>
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: colors.background,
            borderColor: colors.accentBorder,
          },
          disabled && styles.inputDisabled,
        ]}
      >
        <View style={styles.inputCluster}>
          {prefix ? (
            <Text
              style={[
                styles.inputText,
                styles.inputAffix,
                { color: colors.secondaryText },
              ]}
            >
              {prefix}
            </Text>
          ) : null}
          <TextInput
            ref={inputRef}
            accessibilityLabel={label}
            autoCorrect={false}
            editable={!disabled}
            keyboardType="numbers-and-punctuation"
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.secondaryText}
            style={[styles.inputText, styles.input, { color: colors.text }]}
            value={value}
          />
          {suffix ? (
            <Text
              style={[
                styles.inputText,
                styles.inputAffix,
                { color: colors.secondaryText },
              ]}
            >
              {suffix}
            </Text>
          ) : null}
        </View>
        <View style={styles.inputIcon}>
          <SymbolView
            fallback={<Text style={{ color: colors.accent }}>✎</Text>}
            name="pencil"
            size={14}
            tintColor={colors.accent}
            weight="semibold"
          />
        </View>
      </View>
    </Pressable>
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

function templateIncomeRows(template: BudgetTemplate) {
  const income = new Set(
    template.structure.groups
      .filter((group) => group.classification === "income")
      .map((group) => group.id),
  );
  return template.structure.rows
    .filter((row) => income.has(row.groupId))
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : 1));
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
  const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [rowId, setRowId] = useState("");
  const [loading, setLoading] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const selected = templates.find((item) => item.id === templateId);
  const incomeRows = selected ? templateIncomeRows(selected) : [];

  useEffect(() => {
    let active = true;
    repository
      .listTemplates()
      .then((items) => {
        if (!active) return;
        setTemplates(items);
        const first = items[0];
        setTemplateId(first?.id ?? "");
        setRowId(first ? (templateIncomeRows(first)[0]?.id ?? "") : "");
      })
      .catch((reason: unknown) => {
        if (active)
          setApplyError(
            reason instanceof Error
              ? reason.message
              : "Unable to load templates.",
          );
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [repository]);

  function chooseTemplate(id: string) {
    const next = templates.find((item) => item.id === id);
    setTemplateId(id);
    setRowId(next ? (templateIncomeRows(next)[0]?.id ?? "") : "");
  }

  async function apply() {
    if (!selected || !rowId || busy) return;
    setBusy(true);
    setApplyError(null);
    try {
      await repository.savePayProfile(profile);
      const template = await repository.loadTemplate(selected.id);
      if (!template) throw new Error("That template no longer exists.");
      await repository.saveTemplate(
        setTemplateRowRule(template, rowId, {
          kind: "fixed",
          amountMinor: estimate.monthlyTakeHomeMinor,
        }),
      );
      notifyBudgetChanged();
      onClose();
    } catch (reason) {
      setApplyError(
        reason instanceof Error
          ? reason.message
          : "Unable to update the template.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <EditorSheet title="Use in budget" busy={busy} onClose={onClose}>
      {loading ? (
        <ActivityIndicator />
      ) : templates.length ? (
        <>
          <Choices
            label="Template"
            value={templateId}
            options={templates.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={chooseTemplate}
            disabled={busy}
          />
          {incomeRows.length > 1 ? (
            <Choices
              label="Income row"
              value={rowId}
              options={incomeRows.map((row) => ({
                value: row.id,
                label: row.label,
              }))}
              onChange={setRowId}
              disabled={busy}
            />
          ) : null}
          {incomeRows.length ? null : (
            <Note>This template has no income row.</Note>
          )}
        </>
      ) : (
        <Note>Create a template first.</Note>
      )}
      <View style={styles.preview}>
        <Heading>New fixed amount</Heading>
        <Money minorValue={estimate.monthlyTakeHomeMinor} />
      </View>
      <Action
        label={busy ? "Applying…" : "Apply estimate"}
        prominent
        disabled={busy || loading || !rowId}
        onPress={() => void apply()}
      />
      {applyError ? <Note>{applyError}</Note> : null}
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  takeHomeCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  takeHomeLabel: typography.caption,
  inputRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  inputCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
  },
  inputBox: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 40,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    width: 168,
  },
  inputCluster: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  inputText: {
    fontSize: 17,
    fontWeight: "600",
    height: 22,
    includeFontPadding: false,
    lineHeight: 22,
    margin: 0,
    padding: 0,
    textAlignVertical: "center",
  },
  input: {
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
    maxWidth: 112,
    minWidth: 28,
    textAlign: "right",
  },
  inputAffix: { flexShrink: 0 },
  inputIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 16,
  },
  inputDisabled: { opacity: 0.6 },
  detailRow: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
  },
  firstRow: { borderTopWidth: 0 },
  detailLabel: { ...typography.body, flex: 1, paddingRight: spacing.md },
  note: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  preview: { gap: spacing.sm, alignItems: "center", padding: spacing.md },
});
