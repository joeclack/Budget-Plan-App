import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

import { BudgetAmount } from "@/components/budget-amount";
import { GroupMenu } from "@/components/group-menu";
import { SectionCard } from "@/components/section-card";
import {
  describeRule,
  dueDateLabel,
  sortGroupRows,
  type BudgetDocument,
  type BudgetEvaluation,
  type BudgetGroup,
  type BudgetRow,
  type GroupRowSort,
} from "@/domain/budget";
import { groupTone } from "@/theme/group-tone";
import { spacing, typography, useAppColors } from "@/theme/tokens";

type PlanGroupProps = {
  busy: boolean;
  collapsed: boolean;
  document: BudgetDocument;
  evaluation: BudgetEvaluation;
  group: BudgetGroup;
  onAddRow: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onEditGroup: () => void;
  onEditRow: (row: BudgetRow) => void;
  onSortChange: (sort: GroupRowSort) => void;
  sort: GroupRowSort;
};

export function PlanGroup({
  busy,
  collapsed,
  document,
  evaluation,
  group,
  onAddRow,
  onCollapsedChange,
  onEditGroup,
  onEditRow,
  onSortChange,
  sort,
}: PlanGroupProps) {
  const colors = useAppColors();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const tone = groupTone(group.color, scheme);
  const rows = sortGroupRows(
    document.rows.filter((row) => row.groupId === group.id),
    evaluation.rows,
    sort,
    document.month,
  );

  return (
    <SectionCard
      collapsed={collapsed}
      collapsible
      emphasizedHeader
      tone={tone}
      onCollapsedChange={onCollapsedChange}
      title={group.title}
      subtitle={
        {
          income: "Money coming in",
          expense: "Planned spending",
          saving: "Money set aside",
        }[group.classification]
      }
      titleAccessory={
        <GroupMenu
          busy={busy}
          canEdit={!document.month.isLocked}
          groupTitle={group.title}
          sort={sort}
          onAddRow={onAddRow}
          onEditGroup={onEditGroup}
          onSort={onSortChange}
        />
      }
      footer={
        <View
          style={[
            styles.totalRow,
            {
              borderTopColor: colors.separator,
              borderTopWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
          <BudgetAmount result={evaluation.groups[group.id]} variant="strong" />
        </View>
      }
    >
      {rows.map((row, index) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${row.label}`}
          disabled={busy || document.month.isLocked}
          onPress={() => onEditRow(row)}
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
            <Text style={[styles.rowDetail, { color: colors.secondaryText }]}>
              {row.rule.kind === "fixed"
                ? row.notes ||
                  (document.month.isLocked ? "Fixed amount" : "Tap to edit")
                : describeRule(row.rule, document)}
              {row.allocationRole === "informational" ? " · display only" : ""}
              {row.dueDay
                ? ` · ${dueDateLabel(document.month.year, document.month.month, row.dueDay)}`
                : ""}
            </Text>
          </View>
          <BudgetAmount result={evaluation.rows[row.id]} />
        </Pressable>
      ))}
      {rows.length === 0 ? (
        <Text style={[styles.emptyGroup, { color: colors.secondaryText }]}>
          No rows yet.
        </Text>
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.65 },
  emptyGroup: { ...typography.body, paddingVertical: spacing.md },
  totalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 58,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  totalLabel: typography.headline,
});
