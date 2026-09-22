import { useState } from "react";

import { parseBudgetArchive, type BudgetArchive } from "@/domain/backup";
import { pickBackupText } from "@/features/budget/backup-transfer";
import { Action, EditorSheet, Heading, Note } from "./editor-controls";

const when = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function describe(archive: BudgetArchive) {
  const pay = archive.payProfile ? ", including take-home settings" : "";
  return `Backup from ${when.format(new Date(archive.exportedAt))}: ${countLabel(archive.months.length, "month", "months")} and ${countLabel(archive.templates.length, "template", "templates")}${pay}.`;
}

export function BackupSheet({
  busy,
  error,
  savedMonths,
  onExport,
  onRestore,
  onClose,
}: {
  busy: boolean;
  error: string | null;
  savedMonths: number;
  onExport: () => Promise<boolean>;
  onRestore: (archive: BudgetArchive) => Promise<boolean>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<BudgetArchive | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function chooseFile() {
    if (busy || picking) return;
    setPicking(true);
    setLocalError(null);
    setPending(null);
    try {
      const text = await pickBackupText();
      if (text != null) setPending(parseBudgetArchive(text));
    } catch (reason) {
      setLocalError(
        reason instanceof Error
          ? reason.message
          : "That file could not be read.",
      );
    } finally {
      setPicking(false);
    }
  }

  return (
    <EditorSheet title="Back up or restore" busy={busy} onClose={onClose}>
      <Note>
        A backup is one file containing every month, template, payment day and
        take-home setting
        {savedMonths
          ? `. This phone currently has ${countLabel(savedMonths, "saved month", "saved months")}`
          : ""}
        . Keep the file in Files or iCloud. Restoring replaces everything on
        this phone.
      </Note>
      <Heading>Save a copy</Heading>
      <Action
        label={busy ? "Preparing…" : "Save backup file"}
        prominent
        disabled={busy || picking}
        onPress={() => {
          setLocalError(null);
          void onExport().then((saved) => {
            if (saved) onClose();
          });
        }}
      />
      <Heading>Replace from a file</Heading>
      <Action
        label={picking ? "Opening…" : "Choose backup file"}
        disabled={busy || picking}
        onPress={() => void chooseFile()}
      />
      {pending ? (
        <>
          <Note>{describe(pending)}</Note>
          <Note>This replaces the budgets saved on this phone.</Note>
          <Action
            label={busy ? "Restoring…" : "Restore this backup"}
            prominent
            disabled={busy || picking}
            onPress={() => {
              setLocalError(null);
              void onRestore(pending).then((saved) => {
                if (saved) onClose();
              });
            }}
          />
        </>
      ) : null}
      {localError ? <Note>{localError}</Note> : null}
      {error ? <Note>{error}</Note> : null}
    </EditorSheet>
  );
}
