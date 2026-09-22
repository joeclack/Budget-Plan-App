import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

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
  const file = new File(Paths.cache, backupFileName(archive.exportedAt));
  file.create({ overwrite: true });
  file.write(json);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Saving a file is not available on this device.");
  await Sharing.shareAsync(file.uri, {
    dialogTitle: "Save budget backup",
    mimeType: "application/json",
    UTI: "public.json",
  });
}

export async function pickBackupText() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ["application/json", "public.json", "text/plain"],
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.size != null && asset.size > MAX_BACKUP_BYTES)
    throw new Error("This backup file is too large.");
  const text = await new File(asset.uri).text();
  if (text.length > MAX_BACKUP_BYTES)
    throw new Error("This backup file is too large.");
  return text;
}
