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
import { GlassIconButton } from "@/components/glass-icon-button";
import { MonthPickerSheet } from "@/components/month-picker-sheet";
import { PlanActionsMenu } from "@/components/plan-actions-menu";
import { PlanSummary } from "@/components/plan-summary";
import { Screen } from "@/components/screen";
import { UpcomingSheet } from "@/components/upcoming-sheet";
import {
  currentMonthTemplate,
  evaluateBudget,
  formatMinor,
  spendingAmount,
  hasRecordedActuals,
  isSamePeriod,
  missingCurrentMonth,
  scheduledPayments,
} from "@/domain/budget";
import type {
  BudgetDocument,
  BudgetEvaluation,
  BudgetRow,
  BudgetGroup,
  BudgetTemplate,
} from "@/domain/budget/types";
import {
  ArrangeEditor,
  DeleteEditor,
  GroupEditor,
  RowEditor,
} from "@/features/budget/budget-editors";
import {
  Action,
  EditorSheet,
  Heading,
  Note,
} from "@/features/budget/editor-controls";
import { PlanGroup } from "@/features/budget/plan-group";
import { useBudget } from "@/features/budget/use-budget";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type Editor =
  | { kind: "group"; group?: BudgetGroup }
  | { kind: "template"; asNew?: boolean }
  | { kind: "row"; row?: BudgetRow; groupId: string }
  | { kind: "arrange" }
  | { kind: "lock" }
  | { kind: "reset" }
  | { kind: "apply-template"; template?: BudgetTemplate }
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
  const [isUpcomingOpen, setIsUpcomingOpen] = useState(false);
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
  const activeTemplate = document
    ? currentMonthTemplate(document, state.templates)
    : undefined;
  const payments =
    document && evaluation
      ? scheduledPayments(document, evaluation.rows).filter(
          (payment) => payment.status !== "past",
        )
      : [];
  const upcomingEmptyMessage = document?.rows.some(
    (row) => row.dueDay != null && row.allocationRole === "allocation",
  )
    ? "Nothing left this month."
    : "Add payment days to rows to see what is coming up.";
  const monthLabel = monthName(period.year, period.month);
  const nextMonth = missingCurrentMonth(state.months);
  const leftover =
    nextMonth?.source &&
    document &&
    isSamePeriod(document.month, nextMonth.source)
      ? evaluation?.leftToPlan
      : null;
  function openEditor(next: Editor) {
    budget.clearError();
    setEditor(next);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
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
        <GlassIconButton
          accessibilityLabel="Show upcoming transactions"
          onPress={() => setIsUpcomingOpen(true)}
          systemImage="calendar"
        />
      </View>

      {nextMonth && !isSamePeriod(period, nextMonth) ? (
        <View style={[styles.message, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Start {monthName(nextMonth.year, nextMonth.month)}
          </Text>
          <Text style={{ color: colors.secondaryText }}>
            You are still looking at {monthLabel}. Start the current month from
            a copy, or carry anything left to plan into savings.
          </Text>
          {nextMonth.source ? (
            <>
              <GlassButton
                accessibilityLabel={`Copy ${monthName(nextMonth.source.year, nextMonth.source.month)} into ${monthName(nextMonth.year, nextMonth.month)}`}
                disabled={busy}
                label={`Copy ${monthName(nextMonth.source.year, nextMonth.source.month)}`}
                onPress={() =>
                  void budget.createMonth(nextMonth.source!.id, undefined, {
                    year: nextMonth.year,
                    month: nextMonth.month,
                  })
                }
              />
              {leftover?.ok ? (
                <GlassButton
                  accessibilityLabel={`Copy ${monthName(nextMonth.source.year, nextMonth.source.month)} and carry leftover`}
                  disabled={busy}
                  label={
                    leftover.amountMinor === 0
                      ? "Copy and carry leftover"
                      : `Copy and carry ${formatMinor(leftover.amountMinor)} leftover`
                  }
                  prominent
                  onPress={() =>
                    void budget.createMonth(nextMonth.source!.id, undefined, {
                      carryLeftover: true,
                      year: nextMonth.year,
                      month: nextMonth.month,
                    })
                  }
                />
              ) : null}
            </>
          ) : (
            <GlassButton
              accessibilityLabel={`Start ${monthName(nextMonth.year, nextMonth.month)} blank`}
              disabled={busy}
              label="Start current month blank"
              prominent
              onPress={() =>
                void budget.selectPeriod(nextMonth.year, nextMonth.month)
              }
            />
          )}
        </View>
      ) : null}

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
          <PlanSummary
            evaluation={evaluation}
            headline={summaryHeadline(document, evaluation)}
            spendingToggle={spendingToggle(document, evaluation, {
              disabled: busy || document.month.isLocked,
              onValueChange: (enabled) => void budget.setSpending(enabled),
            })}
          />

          <View style={styles.sectionHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your plan
            </Text>
            <PlanActionsMenu
              busy={busy}
              canArrange={document.groups.length > 1}
              canCollapseAll={document.groups.some(
                (group) => !budget.groupPresentation(group.id).collapsed,
              )}
              isLocked={document.month.isLocked}
              onAddGroup={() => openEditor({ kind: "group" })}
              onArrange={() => openEditor({ kind: "arrange" })}
              onCollapseAll={budget.collapseAllGroups}
              onToggleLock={() => openEditor({ kind: "lock" })}
            />
          </View>
          {document.groups.length === 0 ? (
            <Text style={{ color: colors.secondaryText }}>
              Your month is ready. Add a group to begin.
            </Text>
          ) : null}
          {[...document.groups]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((group) => (
              <PlanGroup
                key={group.id}
                busy={busy}
                collapsed={budget.groupPresentation(group.id).collapsed}
                document={document}
                evaluation={evaluation}
                group={group}
                sort={budget.groupPresentation(group.id).sort}
                onAddRow={() => openEditor({ kind: "row", groupId: group.id })}
                onCollapsedChange={(collapsed) =>
                  budget.setGroupCollapsed(group.id, collapsed)
                }
                onEditGroup={() => openEditor({ kind: "group", group })}
                onEditRow={(row) =>
                  openEditor({ kind: "row", row, groupId: group.id })
                }
                onSortChange={(sort) => budget.setGroupSort(group.id, sort)}
              />
            ))}
          <GlassButton
            accessibilityLabel={
              activeTemplate
                ? `Update ${activeTemplate.name} or save as a new template`
                : "Save as a new template"
            }
            disabled={busy}
            label={
              activeTemplate ? `Update ${activeTemplate.name}` : "Save as new"
            }
            onPress={() => openEditor({ kind: "template" })}
          />
          <GlassButton
            accessibilityLabel={
              document.month.isLocked
                ? "Unlock this month before changing its template"
                : state.templates.length
                  ? `Change ${monthLabel} to a different template`
                  : "Save a template before changing this month"
            }
            disabled={
              busy || document.month.isLocked || !state.templates.length
            }
            label="Change template"
            onPress={() => openEditor({ kind: "apply-template" })}
          />
          <GlassButton
            accessibilityLabel={
              document.month.isLocked
                ? "Unlock this month before resetting it"
                : hasRecordedActuals(evaluation)
                  ? `Reset recorded actuals for ${monthLabel}`
                  : "No recorded actuals to reset"
            }
            disabled={
              busy || document.month.isLocked || !hasRecordedActuals(evaluation)
            }
            label="Reset month"
            onPress={() => openEditor({ kind: "reset" })}
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
          {nextMonth && isSamePeriod(period, nextMonth) && nextMonth.source ? (
            <GlassButton
              accessibilityLabel={`Copy ${monthName(nextMonth.source.year, nextMonth.source.month)} and carry leftover`}
              disabled={busy}
              label={`Copy ${monthName(nextMonth.source.year, nextMonth.source.month)} and carry leftover`}
              prominent
              onPress={() =>
                void budget.createMonth(nextMonth.source!.id, undefined, {
                  carryLeftover: true,
                })
              }
            />
          ) : null}
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
        </View>
      )}

      {editor?.kind === "template" && activeTemplate && !editor.asNew ? (
        <EditorSheet
          title="Save template"
          busy={busy}
          onClose={() => setEditor(null)}
        >
          <Note>
            Replace {activeTemplate.name} with this month, or save a new
            template.
          </Note>
          {error ? <Note>{error}</Note> : null}
          <Action
            label={`Update ${activeTemplate.name}`}
            prominent
            disabled={busy}
            onPress={() => {
              void budget
                .replaceTemplate(activeTemplate, { attach: true })
                .then((saved) => {
                  if (saved) setEditor(null);
                });
            }}
          />
          <Action
            label="Save as new"
            disabled={busy}
            onPress={() => openEditor({ kind: "template", asNew: true })}
          />
        </EditorSheet>
      ) : null}
      {editor?.kind === "template" && (!activeTemplate || editor.asNew) ? (
        <BudgetInputSheet
          title="Save as new"
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
      {document && editor?.kind === "apply-template" ? (
        <EditorSheet
          title="Change template"
          busy={busy}
          onClose={() => setEditor(null)}
        >
          {editor.template ? (
            <>
              <Heading>Use {editor.template.name}?</Heading>
              <Note>
                This replaces {monthLabel}&apos;s groups, rows and recorded
                actuals with the template. The calendar month stays the same.
              </Note>
              {error ? <Note>{error}</Note> : null}
              <Action
                label={`Use ${editor.template.name}`}
                prominent
                disabled={busy}
                onPress={() => {
                  void budget
                    .applyTemplate(editor.template.id)
                    .then((saved) => {
                      if (saved) setEditor(null);
                    });
                }}
              />
              <Action
                label="Choose a different template"
                disabled={busy}
                onPress={() => openEditor({ kind: "apply-template" })}
              />
            </>
          ) : (
            <>
              <Note>Choose a template to replace this month&apos;s plan.</Note>
              {error ? <Note>{error}</Note> : null}
              {state.templates.map((template) => (
                <Action
                  key={template.id}
                  accessibilityLabel={`Use template ${template.name}`}
                  disabled={busy}
                  label={template.name}
                  onPress={() =>
                    openEditor({ kind: "apply-template", template })
                  }
                />
              ))}
            </>
          )}
        </EditorSheet>
      ) : null}
      {document && editor?.kind === "reset" ? (
        <EditorSheet
          title="Reset month"
          busy={busy}
          onClose={() => setEditor(null)}
        >
          <Note>
            This clears every recorded actual for {monthLabel}. Planned amounts,
            groups and rules stay as they are.
          </Note>
          {error ? <Note>{error}</Note> : null}
          <Action
            label="Reset month"
            prominent
            disabled={busy}
            onPress={() => {
              void budget.resetMonth().then((saved) => {
                if (saved) setEditor(null);
              });
            }}
          />
          <Action
            label="Keep actuals"
            disabled={busy}
            onPress={() => setEditor(null)}
          />
        </EditorSheet>
      ) : null}
      {document && editor?.kind === "lock" ? (
        <EditorSheet
          title={document.month.isLocked ? "Unlock month" : "Lock month"}
          busy={busy}
          onClose={() => setEditor(null)}
        >
          <Note>
            {document.month.isLocked
              ? "Unlock this month to edit its rows, groups, rules and actuals again."
              : "Lock this month when the plan and actuals are finished. You can still copy it or save a template, and unlock it whenever you need to."}
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
      {isUpcomingOpen ? (
        <UpcomingSheet
          emptyMessage={
            document
              ? upcomingEmptyMessage
              : "Start this month to see upcoming transactions."
          }
          month={period.month}
          payments={payments}
          year={period.year}
          onClose={() => setIsUpcomingOpen(false)}
        />
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

function summaryHeadline(
  document: BudgetDocument,
  evaluation: BudgetEvaluation,
) {
  const spending = spendingAmount(document);
  return spending
    ? { label: "Spending", result: spending }
    : { label: "Left to plan", result: evaluation.leftToPlan };
}

function spendingToggle(
  document: BudgetDocument,
  evaluation: BudgetEvaluation,
  action: {
    disabled: boolean;
    onValueChange: (enabled: boolean) => void;
  },
) {
  const enabled = spendingAmount(document) != null;
  const canTurnOn =
    evaluation.leftToPlan.ok && evaluation.leftToPlan.amountMinor > 0;
  if (!enabled && !canTurnOn) return null;
  return { ...action, enabled };
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.md,
  },
  headerCopy: { flex: 1 },
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
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  sectionTitle: typography.title2,
  footnote: { ...typography.caption, textAlign: "center" },
  emptyMonth: { gap: spacing.md },
  message: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
});
