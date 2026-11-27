// SPDX-License-Identifier: AGPL-3.0-only
//
// Orchestrates signup-completion, login, logout and session validation for
// one tenant's Vault DO. Fully unit-testable: every dependency is injected
// (SqlExecutor, Clock, IdGenerator), so tests never need a real Workers
// runtime. This module only ever touches account/session rows — never
// taxpayer, matter, document or billing data (see TECHNICAL-DESIGN.md §2
// and this repo's CLAUDE.md "non-negotiable security boundary").

import type { Clock, IdGenerator } from "@advocatra/testkit";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  newSessionToken,
  newTotpSecret,
  sha256Hex,
  verifyPassword,
  verifyTotp,
} from "./auth.ts";
import {
  createSession,
  createSetupToken,
  createUser,
  deleteSession,
  deleteSetupToken,
  findSessionByTokenHash,
  findSetupToken,
  findUserByEmail,
  findUserById,
  type SqlExecutor,
  setPassword,
  setTotpSecret,
} from "./data-access/auth-store.ts";

const SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccountDeps {
  readonly sql: SqlExecutor;
  readonly clock: Clock;
  readonly idGen: IdGenerator;
  readonly tenantId: string;
  /** Base64 master key used to encrypt the TOTP secret at rest. TOTP setup is skipped without it. */
  readonly totpMasterKeyBase64?: string;
}

export class AccountError extends Error {}

/** Create the (initially passwordless) account and a one-time setup token. Called by provisionTenant. */
export async function createPendingAccount(
  deps: AccountDeps,
  email: string,
): Promise<{ userId: string; setupToken: string }> {
  const userId = deps.idGen.newId();
  createUser(deps.sql, {
    id: userId,
    email,
    createdAt: deps.clock.now().toISOString(),
  });

  const setupToken = await newSessionToken();
  const tokenHash = await sha256Hex(setupToken);
  createSetupToken(deps.sql, {
    tokenHash,
    userId,
    expiresAt: new Date(deps.clock.now().getTime() + SETUP_TOKEN_TTL_MS).toISOString(),
  });
  return { userId, setupToken };
}

export interface CompleteSetupInput {
  readonly setupToken: string;
  readonly password: string;
  /** If set, TOTP is enabled and this secret must be confirmed by the caller first. */
  readonly totpSecret?: string;
}

export async function completeSetup(
  deps: AccountDeps,
  input: CompleteSetupInput,
): Promise<{ userId: string }> {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AccountError(
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  const tokenHash = await sha256Hex(input.setupToken);
  const token = findSetupToken(deps.sql, tokenHash);
  if (!token) throw new AccountError("invalid or already-used setup token");
  if (new Date(token.expires_at).getTime() < deps.clock.now().getTime()) {
    deleteSetupToken(deps.sql, tokenHash);
    throw new AccountError("setup token expired");
  }

  setPassword(deps.sql, token.user_id, await hashPassword(input.password));
  if (input.totpSecret) {
    if (!deps.totpMasterKeyBase64) {
      throw new AccountError("TOTP is not configured for this environment");
    }
    const encrypted = await encryptTotpSecret(
      deps.totpMasterKeyBase64,
      deps.tenantId,
      input.totpSecret,
    );
    setTotpSecret(deps.sql, token.user_id, encrypted);
  }
  deleteSetupToken(deps.sql, tokenHash);
  return { userId: token.user_id };
}

/** Generate a fresh TOTP secret for the setup flow to show (as a QR/URI) before it's confirmed. */
export function generateTotpSecret(): string {
  return newTotpSecret();
}

export interface LogInInput {
  readonly email: string;
  readonly password: string;
  readonly totpCode?: string;
}

export async function logIn(
  deps: AccountDeps,
  input: LogInInput,
): Promise<{ sessionToken: string }> {
  const user = findUserByEmail(deps.sql, input.email);
  if (
    !user?.password_hash ||
    !(await verifyPassword(input.password, user.password_hash))
  ) {
    throw new AccountError("invalid email or password");
  }
  if (user.totp_secret_encrypted) {
    if (!deps.totpMasterKeyBase64) {
      throw new AccountError("TOTP is not configured for this environment");
    }
    const secret = await decryptTotpSecret(
      deps.totpMasterKeyBase64,
      deps.tenantId,
      user.totp_secret_encrypted,
    );
    if (
      !input.totpCode ||
      !(await verifyTotp(secret, input.totpCode, deps.clock.now().getTime()))
    ) {
      throw new AccountError("invalid or missing two-factor code");
    }
  }

  const sessionToken = await newSessionToken();
  const tokenHash = await sha256Hex(sessionToken);
  createSession(deps.sql, {
    tokenHash,
    userId: user.id,
    createdAt: deps.clock.now().toISOString(),
    expiresAt: new Date(deps.clock.now().getTime() + SESSION_TTL_MS).toISOString(),
  });
  return { sessionToken };
}

export async function logOut(deps: AccountDeps, sessionToken: string): Promise<void> {
  deleteSession(deps.sql, await sha256Hex(sessionToken));
}

export async function validateSession(
  deps: AccountDeps,
  sessionToken: string,
): Promise<{ userId: string; email: string } | null> {
  const tokenHash = await sha256Hex(sessionToken);
  const session = findSessionByTokenHash(deps.sql, tokenHash);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < deps.clock.now().getTime()) {
    deleteSession(deps.sql, tokenHash);
    return null;
  }
  const user = findUserById(deps.sql, session.user_id);
  if (!user) return null;
  return { userId: user.id, email: user.email };
}
