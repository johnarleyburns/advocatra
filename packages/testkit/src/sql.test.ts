// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { FakeSql } from "./sql.ts";

describe("FakeSql", () => {
  it("inserts a row with literal NULLs and bound params, then selects it back", () => {
    const sql = new FakeSql();
    sql.exec(
      "INSERT INTO adv_users (id, email, password_hash, totp_secret_encrypted, created_at) VALUES (?, ?, NULL, NULL, ?)",
      "u1",
      "jane@example.com",
      "2027-01-01T00:00:00Z",
    );
    const rows = sql
      .exec("SELECT * FROM adv_users WHERE email = ?", "jane@example.com")
      .toArray();
    expect(rows).toEqual([
      {
        id: "u1",
        email: "jane@example.com",
        password_hash: null,
        totp_secret_encrypted: null,
        created_at: "2027-01-01T00:00:00Z",
      },
    ]);
  });

  it("returns no rows for a non-matching WHERE clause", () => {
    const sql = new FakeSql();
    sql.exec(
      "INSERT INTO adv_users (id, email, password_hash, totp_secret_encrypted, created_at) VALUES (?, ?, NULL, NULL, ?)",
      "u1",
      "jane@example.com",
      "2027-01-01T00:00:00Z",
    );
    expect(
      sql
        .exec("SELECT * FROM adv_users WHERE email = ?", "nobody@example.com")
        .toArray(),
    ).toEqual([]);
  });

  it("updates a single column by id", () => {
    const sql = new FakeSql();
    sql.exec(
      "INSERT INTO adv_users (id, email, password_hash, totp_secret_encrypted, created_at) VALUES (?, ?, NULL, NULL, ?)",
      "u1",
      "jane@example.com",
      "2027-01-01T00:00:00Z",
    );
    sql.exec("UPDATE adv_users SET password_hash = ? WHERE id = ?", "hashed", "u1");
    const [row] = sql.exec("SELECT * FROM adv_users WHERE id = ?", "u1").toArray();
    expect(row?.password_hash).toBe("hashed");
  });

  it("deletes a row by key", () => {
    const sql = new FakeSql();
    sql.exec(
      "INSERT INTO adv_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      "hash-1",
      "u1",
      "2027-01-01T00:00:00Z",
      "2027-02-01T00:00:00Z",
    );
    sql.exec("DELETE FROM adv_sessions WHERE token_hash = ?", "hash-1");
    expect(
      sql.exec("SELECT * FROM adv_sessions WHERE token_hash = ?", "hash-1").toArray(),
    ).toEqual([]);
  });

  it("throws on a query shape it doesn't recognize", () => {
    const sql = new FakeSql();
    expect(() => sql.exec("SELECT COUNT(*) FROM adv_users")).toThrow(
      /unrecognized query shape/,
    );
  });
});
