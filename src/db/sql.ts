export type SqlValue = string | number | null;

/** The small portion of Expo SQLite also implemented by our real-SQLite test adapter. */
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}

export interface SqlDatabase extends SqlConnection {
  withExclusiveTransactionAsync(
    task: (transaction: SqlConnection) => Promise<void>,
  ): Promise<void>;
}

const queues = new WeakMap<SqlDatabase, Promise<unknown>>();

/** Sharing a database across repositories must not interleave their transactions. */
export function serializeDatabase<T>(db: SqlDatabase, task: () => Promise<T>) {
  const previous = queues.get(db) ?? Promise.resolve();
  const result = previous.then(task, task);
  queues.set(
    db,
    result.catch(() => undefined),
  );
  return result;
}

export async function inTransaction<T>(
  db: SqlDatabase,
  task: (transaction: SqlConnection) => Promise<T>,
): Promise<T> {
  let result!: T;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    result = await task(transaction);
  });
  return result;
}

/** Expo's exclusive transaction opens a connection with its own PRAGMA settings. */
export async function assertForeignKeys(transaction: SqlConnection) {
  const violations = await transaction.getAllAsync("PRAGMA foreign_key_check");
  if (violations.length > 0) {
    throw new Error("The change would leave invalid database references.");
  }
}
