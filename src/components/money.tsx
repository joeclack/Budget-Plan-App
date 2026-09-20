import { StyleSheet, Text } from "react-native";

import { formatGBP } from "@/lib/money";
import { formatMinor } from "@/domain/budget";
import { typography, useAppColors } from "@/theme/tokens";

type MoneyProps = {
  prefix?: string;
  variant?: "body" | "hero" | "heroSmall";
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
  const isHero = variant !== "body";
  const formatted =
    minorValue !== undefined ? formatMinor(minorValue) : formatGBP(value!);

  return (
    <Text
      accessibilityLabel={`${prefix === "−" ? "minus " : ""}${formatted}`}
      style={[
        variant === "hero" && styles.hero,
        variant === "heroSmall" && styles.heroSmall,
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
  hero: typography.display,
  heroSmall: typography.title3,
  body: typography.headline,
});
