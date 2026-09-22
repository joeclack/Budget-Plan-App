import { StyleSheet, Text, View } from "react-native";

import { BudgetAmount } from "@/components/budget-amount";
import { dueDateLabel, type ScheduledPayment } from "@/domain/budget";
import { EditorSheet } from "@/features/budget/editor-controls";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

export function UpcomingSheet({
  emptyMessage,
  month,
  onClose,
  payments,
  year,
}: {
  emptyMessage: string;
  month: number;
  onClose: () => void;
  payments: ScheduledPayment[];
  year: number;
}) {
  const colors = useAppColors();

  return (
    <EditorSheet title="Upcoming" busy={false} onClose={onClose}>
      {payments.length ? (
        <View
          style={[
            styles.list,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {payments.map((payment, index) => (
            <View
              key={payment.row.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopColor: colors.separator,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {payment.row.label}
                </Text>
                <Text style={[styles.detail, { color: colors.secondaryText }]}>
                  {payment.status === "today"
                    ? "Today"
                    : dueDateLabel(year, month, payment.row.dueDay!)}{" "}
                  · {paymentKind(payment.classification)}
                </Text>
              </View>
              <BudgetAmount result={payment.amount} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.secondaryText }}>{emptyMessage}</Text>
      )}
    </EditorSheet>
  );
}

function paymentKind(classification: ScheduledPayment["classification"]) {
  if (classification === "income") return "income";
  if (classification === "saving") return "saving";
  return "payment";
}

const styles = StyleSheet.create({
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  copy: { flex: 1, gap: 3, paddingRight: spacing.md },
  label: typography.body,
  detail: typography.caption,
});
