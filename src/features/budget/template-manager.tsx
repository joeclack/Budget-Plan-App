import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { BudgetDocument, BudgetTemplate } from "../../domain/budget";
import { radius, spacing, typography, useAppColors } from "../../theme/tokens";
import { Action, EditorSheet, Field, Heading, Note } from "./editor-controls";

type Mode = "list" | "edit" | "replace" | "delete";

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
    <EditorSheet title="Manage templates" busy={busy} onClose={onClose}>
      {currentMode === "list" ? (
        <>
          <Heading>
            {templates.length}{" "}
            {templates.length === 1 ? "template" : "templates"}
          </Heading>
          {templates.length ? (
            templates.map((template) => (
              <View
                key={template.id}
                style={[
                  styles.template,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.copy}>
                  <Text style={[styles.name, { color: colors.text }]}>
                    {template.name}
                  </Text>
                  <Note>
                    {template.structure.groups.length} groups ·{" "}
                    {template.structure.rows.length} rows
                  </Note>
                </View>
                <Action
                  label="Manage"
                  accessibilityLabel={`Manage template ${template.name}`}
                  compact
                  disabled={busy}
                  onPress={() => edit(template)}
                />
              </View>
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
          <Action label="Back to templates" disabled={busy} onPress={back} />
          {currentMode === "edit" ? (
            <>
              <Field
                label="Template name"
                value={name}
                onChange={setName}
                autoFocus
                disabled={busy}
              />
              <Note>
                {selected.structure.groups.length} groups ·{" "}
                {selected.structure.rows.length} rows
              </Note>
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
  copy: { flex: 1, gap: spacing.xs },
  name: typography.headline,
});
