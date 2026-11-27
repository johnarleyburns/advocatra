// SPDX-License-Identifier: AGPL-3.0-only
//
// Pure SQL-shaped helpers against an injectable executor — same shape as
// Saldima's data-access/auth-store.ts, extended with the inserts/selects
// this build keeps in this layer rather than inline in the Durable Object,
// so the account/session logic in accounts.ts is testable without a real
// SQLite binding. The real Vault DO (apps/web/src/vault-do.ts) passes its
// `this.sql` (Cloudflare's SqlStorage) in production; tests pass
// `packages/testkit`'s in-memory fake. Both satisfy `SqlExecutor`.

export interface SqlRow {
  [column: string]: string | number | null;
}

export interface SqlCursor {
  toArray(): SqlRow[];
}

export interface SqlExecutor {
  exec(query: string, ...bindings: Array<string | number | null>): SqlCursor;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  totp_secret_encrypted: string | null;
  created_at: string;
}

export interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface SetupTokenRow {
  token_hash: string;
  user_id: string;
  expires_at: string;
}

export function createUser(
  sql: SqlExecutor,
  user: { id: string; email: string; createdAt: string },
): void {
  sql.exec(
    "INSERT INTO adv_users (id, email, password_hash, totp_secret_encrypted, created_at) VALUES (?, ?, NULL, NULL, ?)",
    user.id,
    user.email,
    user.createdAt,
  );
}

export function findUserByEmail(sql: SqlExecutor, email: string): UserRow | null {
  const rows = sql.exec("SELECT * FROM adv_users WHERE email = ?", email).toArray();
  return (rows[0] as UserRow | undefined) ?? null;
}

export function findUserById(sql: SqlExecutor, id: string): UserRow | null {
  const rows = sql.exec("SELECT * FROM adv_users WHERE id = ?", id).toArray();
  return (rows[0] as UserRow | undefined) ?? null;
}

export function setPassword(
  sql: SqlExecutor,
  userId: string,
  passwordHash: string,
): void {
  sql.exec("UPDATE adv_users SET password_hash = ? WHERE id = ?", passwordHash, userId);
}

export function setTotpSecret(
  sql: SqlExecutor,
  userId: string,
  encryptedSecret: string,
): void {
  sql.exec(
    "UPDATE adv_users SET totp_secret_encrypted = ? WHERE id = ?",
    encryptedSecret,
    userId,
  );
}

export function createSetupToken(
  sql: SqlExecutor,
  token: { tokenHash: string; userId: string; expiresAt: string },
): void {
  sql.exec(
    "INSERT INTO adv_setup_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    token.tokenHash,
    token.userId,
    token.expiresAt,
  );
}

export function findSetupToken(
  sql: SqlExecutor,
  tokenHash: string,
): SetupTokenRow | null {
  const rows = sql
    .exec("SELECT * FROM adv_setup_tokens WHERE token_hash = ?", tokenHash)
    .toArray();
  return (rows[0] as SetupTokenRow | undefined) ?? null;
}

export function createSession(
  sql: SqlExecutor,
  session: { tokenHash: string; userId: string; createdAt: string; expiresAt: string },
): void {
  sql.exec(
    "INSERT INTO adv_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    session.tokenHash,
    session.userId,
    session.createdAt,
    session.expiresAt,
  );
}

export function findSessionByTokenHash(
  sql: SqlExecutor,
  tokenHash: string,
): SessionRow | null {
  const rows = sql
    .exec("SELECT * FROM adv_sessions WHERE token_hash = ?", tokenHash)
    .toArray();
  return (rows[0] as SessionRow | undefined) ?? null;
}

/** Session rows are not vault data, but deletes still live in data-access. */
export function deleteSession(sql: SqlExecutor, tokenHash: string): void {
  sql.exec("DELETE FROM adv_sessions WHERE token_hash = ?", tokenHash);
}

export function deleteSetupToken(sql: SqlExecutor, tokenHash: string): void {
  sql.exec("DELETE FROM adv_setup_tokens WHERE token_hash = ?", tokenHash);
}
