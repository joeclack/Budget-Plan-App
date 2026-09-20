import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { useMemo, type PropsWithChildren } from "react";

import { migrateDatabase } from "@/db/migrate";
import { RepositoryContext } from "./context";
import { createBudgetRepository } from "./repository";

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName="budget-plan.db" onInit={migrateDatabase}>
      <RepositoryProvider>{children}</RepositoryProvider>
    </SQLiteProvider>
  );
}

function RepositoryProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const repository = useMemo(() => createBudgetRepository(db), [db]);
  return (
    <RepositoryContext.Provider value={repository}>
      {children}
    </RepositoryContext.Provider>
  );
}
