const listeners = new Set<() => void>();
export function notifyBudgetChanged() {
  for (const listener of listeners) listener();
}
export function subscribeBudgetChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
