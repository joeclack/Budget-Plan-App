import { DatabaseSync } from "node:sqlite";

import type { SqlConnection, SqlDatabase, SqlValue } from "../src/db/sql";

function connection(db: DatabaseSync): SqlConnection {
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, ...params: SqlValue[]) {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
    async getFirstAsync<T>(sql: string, ...params: SqlValue[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: SqlValue[]) {
      return db.prepare(sql).all(...params) as T[];
    },
  };
}

/** Match Expo: exclusive transactions use a different connection to the same file. */
export function openTestDatabase(
  path: string,
): SqlDatabase & { close(): void } {
  const db = new DatabaseSync(path);
  return {
    ...connection(db),
    close: () => db.close(),
    async withExclusiveTransactionAsync(task) {
      const exclusive = new DatabaseSync(path, {
        enableForeignKeyConstraints: false,
      });
      try {
        exclusive.exec("BEGIN");
        await task(connection(exclusive));
        exclusive.exec("COMMIT");
      } catch (error) {
        exclusive.exec("ROLLBACK");
        throw error;
      } finally {
        exclusive.close();
      }
    },
  };
}
