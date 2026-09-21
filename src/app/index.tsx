import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BudgetInputSheet } from "@/components/budget-input-sheet";
import { GlassButton } from "@/components/glass-button";
import { Money } from "@/components/money";
import { MonthPickerSheet } from "@/components/month-picker-sheet";
import { Screen } from "@/components/screen";
import { SectionCard } from "@/components/section-card";
import {
  describeRule,
  dueDateLabel,
  evaluateBudget,
  upcomingPayments,
} from "@/domain/budget";
import type {
  AmountResult,
  BudgetRow,
  BudgetGroup,
} from "@/domain/budget/types";
import {
  ArrangeEditor,
  DeleteEditor,
  GroupEditor,
  RowEditor,
} from "@/features/budget/budget-editors";
import { Action, EditorSheet, Note } from "@/features/budget/editor-controls";
import { useBudget } from "@/features/budget/use-budget";
import { TemplateManager } from "@/features/budget/template-manager";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type Editor =
  | { kind: "group"; group?: BudgetGroup }
  | { kind: "template" }
  | { kind: "templateManager" }
  | { kind: "row"; row?: BudgetRow; groupId: string }
  | { kind: "arrange" }
  | { kind: "lock" }
  | {
      kind: "delete";
      target: { kind: "row" | "group"; id: string; label: string };
    };
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const monthName = (year: number, month: number) =>
  monthFormatter.format(new Date(year, month - 1, 1));

export default function BudgetScreen() {
  const colors = useAppColors();
  const budget = useBudget();
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const { state, busy, error } = budget;

  if (!state) {
    return (
      <Screen>
        <Text style={[styles.title, { color: colors.text }]}>Your budget</Text>
        {error ? (
          <>
            <Text style={{ color: colors.text }}>{error}</Text>
            <GlassButton
              accessibilityLabel="Retry opening budgets"
              label="Try again"
              disabled={busy}
              onPress={() => void budget.retry()}
            />
          </>
        ) : (
          <ActivityIndicator
            accessibilityLabel="Opening budgets"
            color={colors.accent}
          />
        )}
      </Screen>
    );
  }

  const { document, period } = state;
  const evaluation = document ? evaluateBudget(document) : null;
  const payments =
    document && evaluation ? upcomingPayments(document, evaluation.rows) : [];
  const monthLabel = monthName(period.year, period.month);
  function openEditor(next: Editor) {
    budget.clearError();
    setEditor(next);
  }

  return (
    <Screen>
      <View>
        <Text style={[styles.eyebrow, { color: colors.secondaryText }]}>
          MONTHLY PLAN
        </Text>
        <Pressable
          accessibilityLabel={`Choose budget month, currently ${monthLabel}`}
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setIsMonthPickerOpen(true)}
          style={({ pressed }) => [
            styles.monthTitleRow,
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.title, { color: colors.text }]}
          >
            {monthLabel}
          </Text>
          <SymbolView
            fallback={<Text style={{ color: colors.accent }}>⌄</Text>}
            name="chevron.down"
            size={18}
            tintColor={colors.accent}
            weight="semibold"
          />
        </Pressable>
      </View>

      {error && !editor ? (
        <View style={[styles.message, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.text }}>{error}</Text>
          <GlassButton
            accessibilityLabel="Reload saved budgets"
            label="Reload saved budgets"
            onPress={() => void budget.retry()}
            disabled={busy}
          />
        </View>
      ) : null}

      {document && evaluation ? (
        <>
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
            <BudgetAmount result={evaluation.leftToPlan} variant="hero" />
            <View style={styles.summaryBreakdown}>
              <SummaryItem label="Income" result={evaluation.income} />
              <View
                style={[styles.divider, { backgroundColor: colors.heroBorder }]}
              />
              <SummaryItem label="Allocated" result={evaluation.allocated} />
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Upcoming
            </Text>
          </View>
          {payments.length ? (
            <View
              style={[
                styles.upcoming,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {payments.map((payment, index) => (
                <View
                  key={payment.row.id}
                  style={[
                    styles.upcomingRow,
                    index > 0 && {
                      borderTopColor: colors.separator,
                      borderTopWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>
                      {payment.row.label}
                    </Text>
                    <Text
                      style={[
                        styles.rowDetail,
                        { color: colors.secondaryText },
                      ]}
                    >
                      {payment.status === "today"
                        ? "Today"
                        : dueDateLabel(
                            document.month.year,
                            document.month.month,
                            payment.row.dueDay!,
                          )}{" "}
                      ·{" "}
                      {payment.classification === "income"
                        ? "income"
                        : payment.classification === "saving"
                          ? "saving"
                          : "payment"}
                    </Text>
                  </View>
                  <BudgetAmount result={payment.amount} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.secondaryText }}>
              Add payment days to rows to see what is coming up.
            </Text>
          )}

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your plan
            </Text>
            <GlassButton
              accessibilityLabel="Add a budget group"
              compact
              disabled={busy || document.month.isLocked}
              label="Add"
              onPress={() => openEditor({ kind: "group" })}
            />
          </View>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            <GlassButton
              accessibilityLabel="Arrange groups and rows"
              label="Arrange"
              compact
              disabled={
                busy || document.month.isLocked || !document.groups.length
              }
              onPress={() => openEditor({ kind: "arrange" })}
            />
            <GlassButton
              accessibilityLabel={
                document.month.isLocked ? "Unlock month" : "Lock month"
              }
              label={document.month.isLocked ? "Unlock month" : "Lock month"}
              compact
              disabled={busy}
              onPress={() => openEditor({ kind: "lock" })}
            />
          </View>
          {document.month.isLocked ? (
            <Text style={{ color: colors.secondaryText }}>
              This month is locked. Unlock it to make changes.
            </Text>
          ) : (
            <Text style={{ color: colors.secondaryText }}>
              Tap a row to edit its name, amount or calculation.
            </Text>
          )}
          {document.groups.length === 0 ? (
            <Text style={{ color: colors.secondaryText }}>
              Your month is ready. Add a group to begin.
            </Text>
          ) : null}
          {[...document.groups]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((group) => (
              <SectionCard
                key={group.id}
                emphasizedHeader
                title={group.title}
                subtitle={
                  {
                    income: "Money coming in",
                    expense: "Planned spending",
                    saving: "Money set aside",
                  }[group.classification]
                }
                totalContent={
                  <BudgetAmount
                    result={evaluation.groups[group.id]}
                    variant="strong"
                  />
                }
              >
                {document.rows
                  .filter((row) => row.groupId === group.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((row, index) => (
                    <Pressable
                      key={row.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${row.label}`}
                      disabled={busy || document.month.isLocked}
                      onPress={() =>
                        openEditor({ kind: "row", row, groupId: group.id })
                      }
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && {
                          borderTopColor: colors.separator,
                          borderTopWidth: StyleSheet.hairlineWidth,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.rowCopy}>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>
                          {row.label}
                        </Text>
                        <Text
                          style={[
                            styles.rowDetail,
                            { color: colors.secondaryText },
                          ]}
                        >
                          {row.rule.kind === "fixed"
                            ? row.notes ||
                              (document.month.isLocked
                                ? "Fixed amount"
                                : "Tap to edit")
                            : describeRule(row.rule, document)}
                          {row.allocationRole === "informational"
                            ? " · display only"
                            : ""}
                          {row.dueDay
                            ? ` · ${dueDateLabel(document.month.year, document.month.month, row.dueDay)}`
                            : ""}
                        </Text>
                      </View>
                      <BudgetAmount result={evaluation.rows[row.id]} />
                    </Pressable>
                  ))}
                {!document.rows.some((row) => row.groupId === group.id) ? (
                  <Text
                    style={[styles.emptyGroup, { color: colors.secondaryText }]}
                  >
                    No rows yet.
                  </Text>
                ) : null}
                {!document.month.isLocked ? (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: spacing.sm,
                      paddingBottom: spacing.md,
                    }}
                  >
                    <GlassButton
                      accessibilityLabel={`Add row to ${group.title}`}
                      label="Add row"
                      compact
                      disabled={busy}
                      onPress={() =>
                        openEditor({ kind: "row", groupId: group.id })
                      }
                    />
                    <GlassButton
                      accessibilityLabel={`Edit group ${group.title}`}
                      label="Edit group"
                      compact
                      disabled={busy}
                      onPress={() => openEditor({ kind: "group", group })}
                    />
                  </View>
                ) : null}
              </SectionCard>
            ))}
          <GlassButton
            accessibilityLabel="Save this budget as a template"
            disabled={busy}
            label="Save as template"
            onPress={() => openEditor({ kind: "template" })}
          />
          <GlassButton
            accessibilityLabel={`Manage ${state.templates.length} ${state.templates.length === 1 ? "template" : "templates"}`}
            disabled={busy}
            label={`Manage templates (${state.templates.length})`}
            onPress={() => openEditor({ kind: "templateManager" })}
          />
          <Text style={[styles.footnote, { color: colors.secondaryText }]}>
            {busy
              ? "Saving…"
              : Platform.OS === "web"
                ? "Browser preview · saved in this browser"
                : "Saved on this device"}
          </Text>
        </>
      ) : (
        <View style={styles.emptyMonth}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Start this month
          </Text>
          <Text style={{ color: colors.secondaryText }}>
            Choose a starting point for {monthLabel}.
          </Text>
          <GlassButton
            accessibilityLabel="Create blank month"
            label="Start blank"
            disabled={busy}
            onPress={() => void budget.createMonth()}
            prominent
          />
          {state.months.length ? (
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Copy a saved month
            </Text>
          ) : null}
          {state.months.map((source) => (
            <GlassButton
              key={source.id}
              accessibilityLabel={`Copy ${monthName(source.year, source.month)}`}
              label={`Copy ${monthName(source.year, source.month)}`}
              disabled={busy}
              onPress={() => void budget.createMonth(source.id)}
            />
          ))}
          {state.templates.length ? (
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Use a template
            </Text>
          ) : null}
          {state.templates.map((template) => (
            <GlassButton
              key={template.id}
              accessibilityLabel={`Use template ${template.name}`}
              label={template.name}
              disabled={busy}
              onPress={() => void budget.createMonth(undefined, template.id)}
            />
          ))}
          <GlassButton
            accessibilityLabel={`Manage ${state.templates.length} ${state.templates.length === 1 ? "template" : "templates"}`}
            disabled={busy}
            label={`Manage templates (${state.templates.length})`}
            onPress={() => openEditor({ kind: "templateManager" })}
          />
        </View>
      )}

      {editor?.kind === "templateManager" ? (
        <TemplateManager
          templates={state.templates}
          document={document}
          busy={busy}
          error={error}
          onRename={budget.renameTemplate}
          onReplace={budget.replaceTemplate}
          onDelete={budget.deleteTemplate}
          onClose={() => setEditor(null)}
        />
      ) : null}

      {editor?.kind === "template" ? (
        <BudgetInputSheet
          title="Save a template"
          label="Template name"
          busy={busy}
          error={error}
          onClose={() => {
            setEditor(null);
          }}
          onSave={budget.saveTemplate}
        />
      ) : null}
      {document && editor?.kind === "group" ? (
        <GroupEditor
          document={document}
          group={editor.group}
          busy={busy}
          error={error}
          onSave={budget.saveDraft}
          onClose={() => setEditor(null)}
          onDelete={() => {
            if (editor.group)
              openEditor({
                kind: "delete",
                target: {
                  kind: "group",
                  id: editor.group.id,
                  label: editor.group.title,
                },
              });
          }}
        />
      ) : null}
      {document && editor?.kind === "row" ? (
        <RowEditor
          document={document}
          row={editor.row}
          groupId={editor.groupId}
          busy={busy}
          error={error}
          onSave={budget.saveDraft}
          onClose={() => setEditor(null)}
          onDelete={() => {
            if (editor.row)
              openEditor({
                kind: "delete",
                target: {
                  kind: "row",
                  id: editor.row.id,
                  label: editor.row.label,
                },
              });
          }}
        />
      ) : null}
      {document && editor?.kind === "delete" ? (
        <DeleteEditor
          document={document}
          target={editor.target}
          busy={busy}
          error={error}
          onSave={budget.saveDraft}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {document && editor?.kind === "arrange" ? (
        <ArrangeEditor
          document={document}
          busy={busy}
          error={error}
          onSave={budget.saveDraft}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {document && editor?.kind === "lock" ? (
        <EditorSheet
          title={document.month.isLocked ? "Unlock month" : "Lock month"}
          busy={busy}
          onClose={() => setEditor(null)}
        >
          <Note>
            {document.month.isLocked
              ? "Unlock this month to edit its rows, groups and rules again."
              : "Lock this month to prevent accidental edits. You can still copy it or save a template, and unlock it whenever you need to."}
          </Note>
          {error ? <Note>{error}</Note> : null}
          <Action
            label={document.month.isLocked ? "Unlock month" : "Lock month"}
            prominent
            disabled={busy}
            onPress={() => {
              void budget.setLocked(!document.month.isLocked).then((saved) => {
                if (saved) setEditor(null);
              });
            }}
          />
        </EditorSheet>
      ) : null}
      {isMonthPickerOpen ? (
        <MonthPickerSheet
          month={period.month - 1}
          year={period.year}
          onClose={() => setIsMonthPickerOpen(false)}
          onSelect={(year, month) => {
            setIsMonthPickerOpen(false);
            void budget.selectPeriod(year, month + 1);
          }}
        />
      ) : null}
    </Screen>
  );
}

function BudgetAmount({
  result,
  variant = "body",
}: {
  result: AmountResult | undefined;
  variant?: "body" | "strong" | "hero" | "heroSmall";
}) {
  const colors = useAppColors();
  return result?.ok ? (
    <Money minorValue={result.amountMinor} variant={variant} />
  ) : (
    <Text
      style={[
        styles.rowDetail,
        {
          color:
            variant === "hero" || variant === "heroSmall"
              ? colors.heroText
              : colors.text,
          maxWidth: 220,
        },
      ]}
    >
      {result && !result.ok ? result.error.message : "Calculation unavailable"}
    </Text>
  );
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
      <Text
        style={[styles.summaryItemLabel, { color: colors.heroSecondaryText }]}
      >
        {label}
      </Text>
      <BudgetAmount result={result} variant="heroSmall" />
    </View>
  );
}

const styles = StyleSheet.create({
  monthTitleRow: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  pressed: { opacity: 0.65 },
  eyebrow: { ...typography.eyebrow, marginBottom: spacing.xs },
  title: { ...typography.largeTitle, flexShrink: 1 },
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
  emptyMonth: { gap: spacing.md },
  message: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
  upcoming: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  upcomingRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
});
