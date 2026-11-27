// SPDX-License-Identifier: AGPL-3.0-only

/**
 * A minimal in-memory stand-in for Cloudflare's Durable Object SQLite
 * binding, matching the `exec(query, ...bindings).toArray()` shape
 * `apps/web/src/data-access/auth-store.ts` uses. This is not a SQL engine —
 * it pattern-matches the small, fixed set of query shapes that layer
 * actually issues (`INSERT INTO t (cols) VALUES (...)`, `SELECT * FROM t
 * WHERE col = ?`, `UPDATE t SET col = ? [, col = ?] WHERE col = ?`,
 * `DELETE FROM t WHERE col = ?`). A query it doesn't recognize throws
 * loudly rather than silently doing nothing.
 */

type Row = Record<string, string | number | null>;

export class FakeSql {
  private readonly tables = new Map<string, Row[]>();

  private table(name: string): Row[] {
    let rows = this.tables.get(name);
    if (!rows) {
      rows = [];
      this.tables.set(name, rows);
    }
    return rows;
  }

  exec(
    query: string,
    ...bindings: Array<string | number | null>
  ): { toArray(): Row[] } {
    const sql = query.trim();

    const insert = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)$/i);
    if (insert) {
      const [, tableName, columnsRaw, valuesRaw] = insert as unknown as [
        string,
        string,
        string,
        string,
      ];
      const columns = columnsRaw.split(",").map((c) => c.trim());
      const valueTokens = valuesRaw.split(",").map((v) => v.trim());
      let bindingIndex = 0;
      const row: Row = {};
      columns.forEach((column, i) => {
        const token = valueTokens[i];
        row[column] = token === "NULL" ? null : (bindings[bindingIndex++] ?? null);
      });
      this.table(tableName).push(row);
      return { toArray: () => [] };
    }

    const select = sql.match(/^SELECT \* FROM (\w+) WHERE (\w+) = \?$/i);
    if (select) {
      const [, tableName, column] = select as unknown as [string, string, string];
      const value = bindings[0] ?? null;
      const matches = this.table(tableName).filter((row) => row[column] === value);
      return { toArray: () => matches };
    }

    const update = sql.match(/^UPDATE (\w+) SET (.+) WHERE (\w+) = \?$/i);
    if (update) {
      const [, tableName, setClause, whereColumn] = update as unknown as [
        string,
        string,
        string,
        string,
      ];
      const setColumns = setClause.split(",").map((part) => {
        const match = part.trim().match(/^(\w+) = \?$/);
        if (!match)
          throw new Error(`FakeSql: unsupported SET clause "${part}" in: ${sql}`);
        return match[1] as string;
      });
      const whereValue = bindings[setColumns.length] ?? null;
      for (const row of this.table(tableName)) {
        if (row[whereColumn] === whereValue) {
          setColumns.forEach((column, i) => {
            row[column] = bindings[i] ?? null;
          });
        }
      }
      return { toArray: () => [] };
    }

    const del = sql.match(/^DELETE FROM (\w+) WHERE (\w+) = \?$/i);
    if (del) {
      const [, tableName, column] = del as unknown as [string, string, string];
      const value = bindings[0] ?? null;
      const remaining = this.table(tableName).filter((row) => row[column] !== value);
      this.tables.set(tableName, remaining);
      return { toArray: () => [] };
    }

    throw new Error(`FakeSql: unrecognized query shape: ${sql}`);
  }
}
