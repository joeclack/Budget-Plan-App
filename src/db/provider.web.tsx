import { useState, type PropsWithChildren } from "react";
import { createBrowserRepository } from "./browser-repository";
import { RepositoryContext } from "./context";

export function DatabaseProvider({ children }: PropsWithChildren) {
  // Storage is only accessed by repository methods, after client hydration.
  const [repository] = useState(() =>
    createBrowserRepository({
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
    }),
  );
  return (
    <RepositoryContext.Provider value={repository}>
      {children}
    </RepositoryContext.Provider>
  );
}
