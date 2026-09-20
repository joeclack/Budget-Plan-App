import { StyleSheet, Text } from "react-native";

import { formatGBP } from "@/lib/money";
import { typography, useAppColors } from "@/theme/tokens";

type MoneyProps = {
  prefix?: string;
  value: number;
  variant?: "body" | "hero" | "heroSmall";
};

export function Money({ prefix = "", value, variant = "body" }: MoneyProps) {
  const colors = useAppColors();
  const isHero = variant !== "body";

  return (
    <Text
      accessibilityLabel={`${prefix === "−" ? "minus " : ""}${formatGBP(value)}`}
      style={[
        variant === "hero" && styles.hero,
        variant === "heroSmall" && styles.heroSmall,
        variant === "body" && styles.body,
        { color: isHero ? colors.heroText : colors.text },
      ]}
    >
      {prefix}
      {formatGBP(value)}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: typography.display,
  heroSmall: typography.title3,
  body: typography.headline,
});
