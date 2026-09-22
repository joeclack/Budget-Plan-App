import { StyleSheet, Text } from "react-native";

import { formatGBP } from "@/lib/money";
import { formatMinor } from "@/domain/budget";
import { typography, useAppColors } from "@/theme/tokens";

type MoneyProps = {
  prefix?: string;
  variant?: "body" | "strong" | "hero" | "heroSmall";
} & (
  { value: number; minorValue?: never } | { value?: never; minorValue: number }
);

export function Money({
  prefix = "",
  value,
  minorValue,
  variant = "body",
}: MoneyProps) {
  const colors = useAppColors();
  const isHero = variant === "hero" || variant === "heroSmall";
  const formatted =
    minorValue !== undefined ? formatMinor(minorValue) : formatGBP(value!);

  return (
    <Text
      accessibilityLabel={`${prefix === "−" ? "minus " : ""}${formatted}`}
      style={[
        variant === "hero" && styles.hero,
        variant === "heroSmall" && styles.heroSmall,
        variant === "strong" && styles.strong,
        variant === "body" && styles.body,
        { color: isHero ? colors.heroText : colors.text },
      ]}
    >
      {prefix}
      {formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: { ...typography.display, fontVariant: ["tabular-nums"] },
  heroSmall: { ...typography.title3, fontVariant: ["tabular-nums"] },
  strong: { fontSize: 19, fontWeight: "700", lineHeight: 24 },
  body: typography.headline,
});
