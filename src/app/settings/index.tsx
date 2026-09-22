import { Host, Switch } from "@expo/ui";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

import { GlassButton } from "@/components/glass-button";
import { Screen } from "@/components/screen";
import { BackupSheet } from "@/features/budget/backup-sheet";
import { TemplateManager } from "@/features/budget/template-manager";
import { useBudget } from "@/features/budget/use-budget";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type SettingsAction = "templates" | "backup";

export default function SettingsScreen() {
  const colors = useAppColors();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  const router = useRouter();
  const budget = useBudget();
  const [action, setAction] = useState<SettingsAction | null>(null);
  const { state, busy, error } = budget;

  if (!state) {
    return (
      <Screen>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        {error ? (
          <>
            <Text style={{ color: colors.text }}>{error}</Text>
            <GlassButton
              accessibilityLabel="Retry opening settings"
              label="Try again"
              disabled={busy}
              onPress={() => void budget.retry()}
            />
          </>
        ) : (
          <ActivityIndicator
            accessibilityLabel="Opening settings"
            color={colors.accent}
          />
        )}
      </Screen>
    );
  }

  const templateCount = state.templates.length;
  const items: {
    action: SettingsAction;
    label: string;
    detail: string;
  }[] = [
    {
      action: "templates",
      label: "Manage templates",
      detail: templateCount === 1 ? "1 template" : `${templateCount} templates`,
    },
    {
      action: "backup",
      label: "Back up or restore",
      detail: "Save or replace every month and template",
    },
  ];

  function openAction(next: SettingsAction) {
    budget.clearError();
    setAction(next);
  }

  return (
    <Screen>
      <View>
        <Text style={[styles.eyebrow, { color: colors.secondaryText }]}>
          APP
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      {error && !action ? (
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

      <View
        style={[
          styles.list,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityLabel="Copy last month forward"
          accessibilityRole="switch"
          accessibilityState={{
            checked: state.autoApplyRecentMonth,
            disabled: busy,
          }}
          disabled={busy}
          onPress={() =>
            void budget.setAutoApplyRecentMonth(!state.autoApplyRecentMonth)
          }
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowCopy}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Copy last month forward
            </Text>
            <Text style={[styles.rowDetail, { color: colors.secondaryText }]}>
              When a new month starts, apply the most recent plan
            </Text>
          </View>
          <Host
            colorScheme={colorScheme}
            matchContents
            pointerEvents="none"
            seedColor={colors.accent}
          >
            <Switch
              value={state.autoApplyRecentMonth}
              onValueChange={() => undefined}
            />
          </Host>
        </Pressable>
      </View>

      <View
        style={[
          styles.list,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityLabel="Take-home calculator"
          accessibilityRole="button"
          onPress={() => router.push("/settings/take-home")}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowCopy}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Take-home calculator
            </Text>
            <Text style={[styles.rowDetail, { color: colors.secondaryText }]}>
              Estimate monthly pay
            </Text>
          </View>
          <Chevron />
        </Pressable>
        {items.map((item) => (
          <Pressable
            key={item.action}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => openAction(item.action)}
            style={({ pressed }) => [
              styles.row,
              {
                borderTopColor: colors.separator,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowCopy}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {item.label}
              </Text>
              <Text style={[styles.rowDetail, { color: colors.secondaryText }]}>
                {item.detail}
              </Text>
            </View>
            <Chevron />
          </Pressable>
        ))}
      </View>

      <Text style={[styles.footnote, { color: colors.secondaryText }]}>
        {busy
          ? "Saving…"
          : Platform.OS === "web"
            ? "Browser preview · saved in this browser"
            : "Saved on this device"}
      </Text>

      {action === "templates" ? (
        <TemplateManager
          templates={state.templates}
          document={state.document}
          busy={busy}
          error={error}
          onRename={budget.renameTemplate}
          onReplace={budget.replaceTemplate}
          onDelete={budget.deleteTemplate}
          onClose={() => setAction(null)}
        />
      ) : null}

      {action === "backup" ? (
        <BackupSheet
          busy={busy}
          error={error}
          savedMonths={state.months.length}
          onExport={budget.exportArchive}
          onRestore={budget.restoreArchive}
          onClose={() => setAction(null)}
        />
      ) : null}
    </Screen>
  );
}

function Chevron() {
  const colors = useAppColors();
  return (
    <SymbolView
      fallback={<Text style={{ color: colors.secondaryText }}>›</Text>}
      name="chevron.right"
      size={14}
      tintColor={colors.secondaryText}
      weight="semibold"
    />
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.eyebrow, marginBottom: spacing.xs },
  title: typography.largeTitle,
  list: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
  },
  row: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    minHeight: 64,
    paddingVertical: spacing.sm,
    width: "100%",
  },
  rowCopy: { flex: 1, gap: 3, paddingRight: spacing.md },
  rowLabel: typography.body,
  rowDetail: typography.caption,
  pressed: { opacity: 0.65 },
  footnote: { ...typography.caption, textAlign: "center" },
  message: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
});
