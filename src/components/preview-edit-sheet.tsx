import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GlassButton } from "@/components/glass-button";
import { radius, spacing, typography, useAppColors } from "@/theme/tokens";

type PreviewEditSheetProps = {
  onClose: () => void;
  onSave: (name: string) => void;
  visible: boolean;
};

export function PreviewEditSheet({
  onClose,
  onSave,
  visible,
}: PreviewEditSheetProps) {
  const colors = useAppColors();
  const [name, setName] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  function save() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(trimmedName);
    setName("");
  }

  function close() {
    Keyboard.dismiss();
    setName("");
    onClose();
  }

  return (
    <Modal
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={close}
      presentationStyle="pageSheet"
      transparent={Platform.OS !== "ios"}
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.keyboardView,
          Platform.OS === "ios" ? styles.iosKeyboardView : styles.backdrop,
          Platform.OS === "ios" && { backgroundColor: colors.surface },
        ]}
      >
        {Platform.OS !== "ios" ? (
          <Pressable
            accessibilityRole="button"
            onPress={close}
            style={styles.dismissArea}
          />
        ) : null}
        <View
          style={[
            styles.sheet,
            Platform.OS !== "ios" && styles.fallbackSheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: colors.text }]}
              >
                Add a group
              </Text>
              <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
                Milestone 1 interaction preview
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close add group sheet"
              accessibilityRole="button"
              onPressIn={close}
            >
              <Text style={[styles.close, { color: colors.accent }]}>
                Close
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Group name</Text>
          <TextInput
            accessibilityLabel="Budget group name"
            autoFocus
            onChangeText={setName}
            onSubmitEditing={save}
            placeholder="For example, Travel"
            placeholderTextColor={colors.secondaryText}
            returnKeyType="done"
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={name}
          />
          <GlassButton
            accessibilityLabel="Save budget group"
            disabled={!name.trim()}
            label="Add group"
            onPress={save}
            prominent
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  iosKeyboardView: { justifyContent: "flex-start", paddingTop: spacing.lg },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.36)",
    justifyContent: "flex-end",
  },
  dismissArea: { flex: 1 },
  sheet: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  fallbackSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: typography.title2,
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  close: typography.callout,
  label: typography.headline,
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
});
