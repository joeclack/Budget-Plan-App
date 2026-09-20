import type { PropsWithChildren } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, useAppColors } from "@/theme/tokens";

export function Screen({ children }: PropsWithChildren) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.content,
          {
            // Native tabs float at the top on web and at the bottom on iPhone.
            paddingTop:
              insets.top + spacing.md + (Platform.OS === "web" ? 64 : 0),
            paddingBottom: insets.bottom + spacing.xxl + spacing.xl,
          },
        ]}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
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
  },
});
