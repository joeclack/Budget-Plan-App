import * as DocumentPicker from "expo-document-picker";

import {
  MAX_BACKUP_BYTES,
  serializeBudgetArchive,
  type BudgetArchive,
} from "@/domain/backup";

function backupFileName(exportedAt: string) {
  return `budget-plan-${exportedAt.slice(0, 10)}.json`;
}

export async function shareBudgetArchive(archive: BudgetArchive) {
  const json = serializeBudgetArchive(archive);
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFileName(archive.exportedAt);
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function pickBackupText() {
  const result = await DocumentPicker.getDocumentAsync({
    base64: false,
    copyToCacheDirectory: true,
    multiple: false,
    type: "application/json",
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.size != null && asset.size > MAX_BACKUP_BYTES)
    throw new Error("This backup file is too large.");
  const text = asset.file
    ? await asset.file.text()
    : await (await fetch(asset.uri)).text();
  if (text.length > MAX_BACKUP_BYTES)
    throw new Error("This backup file is too large.");
  return text;
}
