import { StyleSheet, Text } from "react-native";

import { Money } from "@/components/money";
import type { AmountResult } from "@/domain/budget/types";
import { typography, useAppColors } from "@/theme/tokens";

export function BudgetAmount({
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
        styles.detail,
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

const styles = StyleSheet.create({
  detail: typography.caption,
});
