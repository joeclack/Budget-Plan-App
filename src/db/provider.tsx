import { SQLiteProvider } from "expo-sqlite";
import type { PropsWithChildren } from "react";

import { migrateDatabase } from "@/db/migrate";

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName="budget-plan.db" onInit={migrateDatabase}>
      {children}
    </SQLiteProvider>
  );
}
