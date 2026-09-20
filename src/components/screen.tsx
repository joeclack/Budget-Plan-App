import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { spacing, useAppColors } from "@/theme/tokens";

export function Screen({ children }: PropsWithChildren) {
  const colors = useAppColors();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
