import type { PropsWithChildren } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GlassButton } from "@/components/glass-button";
import { evaluateBudget, formatMinor } from "@/domain/budget";
import type { BudgetDocument } from "@/domain/budget";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

export function EditorSheet({
  title,
  busy,
  onClose,
  children,
}: PropsWithChildren<{ title: string; busy: boolean; onClose: () => void }>) {
  const colors = useAppColors();
  function close() {
    if (!busy) {
      Keyboard.dismiss();
      onClose();
    }
  }
  return (
    <Modal
      visible
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          paddingTop: spacing.xl,
        }}
      >
        <View style={editorStyles.header}>
          <Text style={[typography.title2, { color: colors.text, flex: 1 }]}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
            disabled={busy}
            onPress={close}
            hitSlop={12}
          >
            <Text style={[typography.callout, { color: colors.accent }]}>
              Close
            </Text>
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={editorStyles.form}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Note({ children }: PropsWithChildren) {
  const colors = useAppColors();
  return (
    <Text style={[typography.caption, { color: colors.secondaryText }]}>
      {children}
    </Text>
  );
}
export function Heading({ children }: PropsWithChildren) {
  const colors = useAppColors();
  return (
    <Text style={[typography.headline, { color: colors.text }]}>
      {children}
    </Text>
  );
}
export function Field({
  label,
  value,
  onChange,
  autoFocus = false,
  multiline = false,
  numeric = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  multiline?: boolean;
  numeric?: boolean;
  disabled?: boolean;
}) {
  const colors = useAppColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <Heading>{label}</Heading>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        autoFocus={autoFocus}
        multiline={multiline}
        editable={!disabled}
        keyboardType={numeric ? "numbers-and-punctuation" : "default"}
        autoCorrect={!numeric && !multiline}
        autoCapitalize={multiline ? "none" : "sentences"}
        style={[
          editorStyles.input,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
          multiline && {
            minHeight: 100,
            textAlignVertical: "top",
            paddingTop: spacing.md,
          },
        ]}
      />
    </View>
  );
}
export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const colors = useAppColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <Heading>{label}</Heading>
      <View style={editorStyles.wrap}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ selected: option.value === value }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[
              editorStyles.choice,
              {
                backgroundColor:
                  option.value === value
                    ? colors.accentSoft
                    : colors.background,
                borderColor:
                  option.value === value ? colors.accent : colors.border,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                typography.callout,
                { color: option.value === value ? colors.accent : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Action({
  label,
  onPress,
  disabled = false,
  prominent = false,
  accessibilityLabel,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  prominent?: boolean;
  accessibilityLabel?: string;
  compact?: boolean;
}) {
  return (
    <GlassButton
      accessibilityLabel={accessibilityLabel ?? label}
      label={label}
      onPress={onPress}
      disabled={disabled}
      prominent={prominent}
      compact={compact}
    />
  );
}

export function DraftPreview({
  original,
  draft,
  error,
}: {
  original: BudgetDocument;
  draft: BudgetDocument | null;
  error: string | null;
}) {
  const colors = useAppColors();
  const before = evaluateBudget(original);
  const after = draft ? evaluateBudget(draft) : null;
  const changed =
    draft?.rows.filter((row) => {
      const a = before.rows[row.id];
      const b = after?.rows[row.id];
      return b?.ok && (!a?.ok || a.amountMinor !== b.amountMinor);
    }) ?? [];
  return (
    <View
      style={[editorStyles.preview, { backgroundColor: colors.accentSoft }]}
    >
      <Heading>Preview · this month only</Heading>
      {error ? <Text style={{ color: colors.text }}>{error}</Text> : null}
      {after ? (
        <>
          {(
            [
              ["Income", after.income],
              ["Allocated", after.allocated],
              ["Left to plan", after.leftToPlan],
            ] as const
          ).map(([label, result]) => (
            <Text
              key={label}
              style={[typography.callout, { color: colors.text }]}
            >
              {label}:{" "}
              {result.ok
                ? formatMinor(result.amountMinor)
                : result.error.message}
            </Text>
          ))}
          {after.leftToPlan.ok && before.leftToPlan.ok ? (
            <Note>
              Previously left to plan:{" "}
              {formatMinor(before.leftToPlan.amountMinor)}
            </Note>
          ) : null}
          {changed.map((row) => {
            const result = after.rows[row.id];
            return (
              <Note key={row.id}>
                {row.label}:{" "}
                {result.ok
                  ? formatMinor(result.amountMinor)
                  : result.error.message}
              </Note>
            );
          })}
        </>
      ) : (
        <Note>Complete the fields to see the updated totals.</Note>
      )}
      <Note>
        Nothing changes until you save. Existing templates stay as they are.
      </Note>
    </View>
  );
}

export const editorStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    fontSize: 17,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  preview: { padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
});
