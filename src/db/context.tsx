import { createContext, useContext } from "react";
import type { BudgetRepository } from "./repository";

export const RepositoryContext = createContext<BudgetRepository | null>(null);

export function useBudgetRepository() {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error("Budget storage is not ready.");
  return repository;
}
