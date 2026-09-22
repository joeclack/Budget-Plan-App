import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

import type {
  BudgetDocument,
  BudgetGroup,
  BudgetTemplate,
} from "../../domain/budget";
import { groupTone } from "../../theme/group-tone";
import { radius, spacing, typography, useAppColors } from "../../theme/tokens";
import { Action, EditorSheet, Field, Heading, Note } from "./editor-controls";

type Mode = "list" | "edit" | "replace" | "delete";

const classificationLabel = {
  income: "Income",
  expense: "Spending",
  saving: "Saving",
} as const;

function sortedGroups(template: BudgetTemplate) {
  return [...template.structure.groups].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

function groupRowCount(template: BudgetTemplate, group: BudgetGroup) {
  return template.structure.rows.filter((row) => row.groupId === group.id)
    .length;
}

function TemplateGroups({ template }: { template: BudgetTemplate }) {
  const colors = useAppColors();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const groups = sortedGroups(template);
  if (!groups.length) return <Note>No groups in this template.</Note>;
  return (
    <View style={styles.groups}>
      {groups.map((group) => {
        const rows = groupRowCount(template, group);
        const tone = groupTone(group.color, scheme);
        return (
          <View
            key={group.id}
            style={[
              styles.group,
              {
                backgroundColor: tone ? "transparent" : colors.surface,
                borderColor: tone?.border ?? colors.border,
              },
            ]}
          >
            {tone ? (
              <View pointerEvents="none" style={styles.groupTone}>
                <LinearGradient
                  colors={tone.colors}
                  dither
                  end={tone.end}
                  locations={tone.locations}
                  start={tone.start}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={tone.sheen}
                  end={{ x: 0.9, y: 0.65 }}
                  start={{ x: 0.1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : null}
            <Text style={[styles.groupTitle, { color: colors.text }]}>
              {group.title}
            </Text>
            <Text style={[styles.groupDetail, { color: colors.secondaryText }]}>
              {classificationLabel[group.classification]} · {rows}{" "}
              {rows === 1 ? "row" : "rows"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function TemplateManager({
  templates,
  document,
  busy,
  error,
  onRename,
  onReplace,
  onDelete,
  onClose,
}: {
  templates: BudgetTemplate[];
  document: BudgetDocument | null;
  busy: boolean;
  error: string | null;
  onRename: (template: BudgetTemplate, name: string) => Promise<boolean>;
  onReplace: (template: BudgetTemplate) => Promise<boolean>;
  onDelete: (template: BudgetTemplate) => Promise<boolean>;
  onClose: () => void;
}) {
  const colors = useAppColors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("list");
  const selected = templates.find((item) => item.id === selectedId) ?? null;
  const [name, setName] = useState("");
  const currentMode = selected ? mode : "list";

  function edit(template: BudgetTemplate) {
    setSelectedId(template.id);
    setName(template.name);
    setMode("edit");
  }

  function back() {
    setSelectedId(null);
    setName("");
    setMode("list");
  }

  async function rename() {
    if (!selected) return;
    if (await onRename(selected, name)) back();
  }

  async function replace() {
    if (!selected) return;
    if (await onReplace(selected)) back();
  }

  async function remove() {
    if (!selected) return;
    if (await onDelete(selected)) back();
  }

  return (
    <EditorSheet
      title="Manage templates"
      busy={busy}
      dismissLabel={currentMode === "list" ? "Close" : "Back"}
      onClose={currentMode === "list" ? onClose : back}
    >
      {currentMode === "list" ? (
        <>
          <Heading>
            {templates.length}{" "}
            {templates.length === 1 ? "template" : "templates"}
          </Heading>
          {templates.length ? (
            templates.map((template) => (
              <Pressable
                key={template.id}
                accessibilityLabel={`Manage template ${template.name}`}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => edit(template)}
                style={({ pressed }) => [
                  styles.template,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.name, { color: colors.text }]}>
                  {template.name}
                </Text>
                <SymbolView
                  fallback={
                    <Text style={{ color: colors.secondaryText }}>›</Text>
                  }
                  name="chevron.right"
                  size={14}
                  tintColor={colors.secondaryText}
                  weight="semibold"
                />
              </Pressable>
            ))
          ) : (
            <Note>
              No templates yet. Save the current month as a template to create
              one.
            </Note>
          )}
        </>
      ) : selected ? (
        <>
          {currentMode === "edit" ? (
            <>
              <Field
                label="Template name"
                value={name}
                onChange={setName}
                disabled={busy}
              />
              <Heading>Groups</Heading>
              <TemplateGroups template={selected} />
              <Action
                label="Save name"
                prominent
                disabled={busy || !name.trim() || name.trim() === selected.name}
                onPress={() => void rename()}
              />
              {document ? (
                <Action
                  label="Update from current month…"
                  accessibilityLabel={`Update template ${selected.name} from current month`}
                  disabled={busy}
                  onPress={() => setMode("replace")}
                />
              ) : null}
              <Action
                label="Delete template…"
                accessibilityLabel={`Delete template ${selected.name}`}
                disabled={busy}
                onPress={() => setMode("delete")}
              />
            </>
          ) : currentMode === "replace" ? (
            <>
              <Heading>Update {selected.name}?</Heading>
              <Note>
                This replaces the template&apos;s saved groups, rows, amounts
                and payment days with the current month. Existing budget months
                are unchanged.
              </Note>
              <Action
                label={busy ? "Updating…" : "Update template"}
                prominent
                disabled={busy || !document}
                onPress={() => void replace()}
              />
              <Action
                label="Cancel"
                disabled={busy}
                onPress={() => setMode("edit")}
              />
            </>
          ) : (
            <>
              <Heading>Delete {selected.name}?</Heading>
              <Note>
                This removes the reusable template. Budget months already made
                from it are unchanged.
              </Note>
              <Action
                label={busy ? "Deleting…" : "Delete template"}
                prominent
                disabled={busy}
                onPress={() => void remove()}
              />
              <Action
                label="Cancel"
                disabled={busy}
                onPress={() => setMode("edit")}
              />
            </>
          )}
          {error ? <Note>{error}</Note> : null}
        </>
      ) : null}
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  template: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  name: { ...typography.headline, flex: 1 },
  groups: { gap: spacing.sm },
  group: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  groupTone: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  groupTitle: typography.callout,
  groupDetail: typography.caption,
  pressed: { opacity: 0.65 },
});
