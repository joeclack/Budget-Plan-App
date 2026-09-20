import { useState } from "react";
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
import { GlassButton } from "./glass-button";
import { radius, spacing, typography, useAppColors } from "../theme/tokens";

type Props = {
  title: string;
  label: string;
  initialValue?: string;
  decimal?: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (value: string) => Promise<boolean>;
};

export function BudgetInputSheet({
  title,
  label,
  initialValue = "",
  decimal = false,
  busy,
  error,
  onClose,
  onSave,
}: Props) {
  const colors = useAppColors();
  const [value, setValue] = useState(initialValue);
  function close() {
    if (busy) return;
    Keyboard.dismiss();
    onClose();
  }
  async function save() {
    if (!value.trim() || busy) return;
    if (await onSave(value.trim())) {
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
        style={[styles.root, { backgroundColor: colors.surface }]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${title}`}
            disabled={busy}
            onPress={close}
            hitSlop={12}
          >
            <Text style={[styles.close, { color: colors.accent }]}>Close</Text>
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.form}
        >
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          <TextInput
            accessibilityLabel={label}
            autoFocus
            editable={!busy}
            keyboardType={decimal ? "numbers-and-punctuation" : "default"}
            onChangeText={setValue}
            onSubmitEditing={save}
            returnKeyType="done"
            selectTextOnFocus={decimal}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={value}
          />
          {error ? <Text style={{ color: colors.text }}>{error}</Text> : null}
          <GlassButton
            accessibilityLabel={`Save ${label}`}
            disabled={busy || !value.trim()}
            label={busy ? "Saving…" : "Save"}
            onPress={() => void save()}
            prominent
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: { ...typography.title2, flex: 1 },
  close: typography.callout,
  form: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  label: typography.headline,
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
});
