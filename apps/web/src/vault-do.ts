// SPDX-License-Identifier: AGPL-3.0-only
//
// One Vault Durable Object per tenant (idFromName(tenantId), resolved by
// the edge layer via KV — see edge/tenant-lookup.ts). Account/session
// routes plus the R2-backed encrypted snapshot sync routes (upload/
// download/lease) live here.
//
// HARD RULE: this file, and everything added to it later, must never call
// a decrypt function from @advocatra/crypto or @advocatra/vault — enforced
// mechanically by scripts/check-no-decrypt-in-app.mjs in CI, not just by
// this comment. The server stores and serves ciphertext only — see this
// repo's CLAUDE.md "non-negotiable security boundary" and
// TECHNICAL-DESIGN.md §2/§5. The vault.ts routes below pass the uploaded
// snapshot straight to R2 and only ever inspect `EncryptedEnvelopeSchema`'s
// metadata (version/algorithm/base64 strings) — never the plaintext.

import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import type { AccountDeps } from "./accounts.ts";
import {
  completeSetup,
  createPendingAccount,
  generateTotpSecret,
  logIn,
  logOut,
  validateSession,
} from "./accounts.ts";
import {
  clearedSessionCookie,
  readCookie,
  sessionCookie,
  sessionCookieName,
} from "./auth.ts";
import type { SqlExecutor } from "./data-access/auth-store.ts";
import {
  acquireOrRenewLease,
  downloadSnapshot,
  LeaseConflictError,
  type ObjectStorePort,
  RevisionConflictError,
  type UploadInput,
  uploadSnapshot,
  type VaultDeps,
  VaultSyncError,
} from "./vault.ts";

interface Env {
  TOTP_MASTER_KEY?: string;
  R2: ObjectStorePort;
}

const MIGRATIONS = [
  "CREATE TABLE IF NOT EXISTS adv_users (id TEXT PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT, totp_secret_encrypted TEXT, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS adv_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS adv_setup_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS adv_vault_state (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, snapshot_r2_key TEXT, lease_json TEXT, updated_at TEXT NOT NULL)",
];

export class Vault extends DurableObject<Env> {
  private readonly app = new Hono();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    for (const migration of MIGRATIONS) this.sql().exec(migration);
    this.registerRoutes();
  }

  private sql(): SqlExecutor {
    // Cloudflare's DO SqlStorage satisfies SqlExecutor structurally
    // (exec(query, ...bindings) returning a cursor with .toArray()).
    return this.ctx.storage.sql as unknown as SqlExecutor;
  }

  private tenantId(request: Request): string {
    return request.headers.get("X-Advocatra-Tenant-Id") ?? "unknown-tenant";
  }

  private deps(request: Request): AccountDeps {
    return {
      sql: this.sql(),
      clock: { now: () => new Date() },
      idGen: { newId: () => crypto.randomUUID() },
      tenantId: this.tenantId(request),
      ...(this.env.TOTP_MASTER_KEY !== undefined
        ? { totpMasterKeyBase64: this.env.TOTP_MASTER_KEY }
        : {}),
    };
  }

  private vaultDeps(request: Request): VaultDeps {
    return {
      sql: this.sql(),
      r2: this.env.R2,
      clock: { now: () => new Date() },
      tenantId: this.tenantId(request),
    };
  }

  /** Session cookie check shared by every /vault/* route. Returns the session or null. */
  private async requireSession(
    request: Request,
  ): Promise<{ userId: string; email: string } | null> {
    const secure = new URL(request.url).protocol === "https:";
    const token = readCookie(request.headers.get("Cookie"), sessionCookieName(secure));
    return token ? validateSession(this.deps(request), token) : null;
  }

  private registerRoutes(): void {
    // Called once, internally, by the Worker's /webhook/stripe handler
    // (never by an end user) to create the pending account this tenant's
    // setup link will complete.
    this.app.post("/setup/provision", async (c) => {
      const body = await c.req.json<{ email: string }>();
      const { setupToken } = await createPendingAccount(
        this.deps(c.req.raw),
        body.email,
      );
      return c.json({ setupToken });
    });

    this.app.post("/setup", async (c) => {
      const body = await c.req.json<{
        setupToken: string;
        password: string;
        totpSecret?: string;
      }>();
      try {
        await completeSetup(this.deps(c.req.raw), body);
        return c.json({ ok: true });
      } catch (error) {
        return c.json({ ok: false, error: (error as Error).message }, 400);
      }
    });

    this.app.get("/setup/totp-secret", (c) => c.json({ secret: generateTotpSecret() }));

    this.app.post("/login", async (c) => {
      const body = await c.req.json<{
        email: string;
        password: string;
        totpCode?: string;
      }>();
      const secure = new URL(c.req.url).protocol === "https:";
      try {
        const { sessionToken } = await logIn(this.deps(c.req.raw), body);
        c.header(
          "Set-Cookie",
          sessionCookie(sessionCookieName(secure), sessionToken, secure),
        );
        return c.json({ ok: true });
      } catch (error) {
        return c.json({ ok: false, error: (error as Error).message }, 401);
      }
    });

    this.app.post("/logout", async (c) => {
      const secure = new URL(c.req.url).protocol === "https:";
      const token = readCookie(
        c.req.header("Cookie") ?? null,
        sessionCookieName(secure),
      );
      if (token) await logOut(this.deps(c.req.raw), token);
      c.header("Set-Cookie", clearedSessionCookie(sessionCookieName(secure), secure));
      return c.json({ ok: true });
    });

    this.app.get("/session", async (c) => {
      const secure = new URL(c.req.url).protocol === "https:";
      const token = readCookie(
        c.req.header("Cookie") ?? null,
        sessionCookieName(secure),
      );
      const session = token ? await validateSession(this.deps(c.req.raw), token) : null;
      return session ? c.json({ ok: true, ...session }) : c.json({ ok: false }, 401);
    });

    // Encrypted vault snapshot sync — every route below requires a valid
    // session, and none of them ever decrypt the snapshot they handle.
    this.app.get("/vault/snapshot", async (c) => {
      if (!(await this.requireSession(c.req.raw)))
        return c.json({ ok: false, error: "unauthenticated" }, 401);
      const result = await downloadSnapshot(this.vaultDeps(c.req.raw));
      return c.json({ ok: true, ...result });
    });

    this.app.post("/vault/lease", async (c) => {
      if (!(await this.requireSession(c.req.raw)))
        return c.json({ ok: false, error: "unauthenticated" }, 401);
      const { deviceId } = await c.req.json<{ deviceId: string }>();
      try {
        const lease = acquireOrRenewLease(this.vaultDeps(c.req.raw), deviceId);
        return c.json({ ok: true, lease });
      } catch (error) {
        if (error instanceof LeaseConflictError)
          return c.json({ ok: false, error: error.message }, 409);
        throw error;
      }
    });

    this.app.post("/vault/snapshot", async (c) => {
      if (!(await this.requireSession(c.req.raw)))
        return c.json({ ok: false, error: "unauthenticated" }, 401);
      // `snapshot`'s real shape is only guaranteed by EncryptedEnvelopeSchema
      // inside uploadSnapshot, which parses it before anything else touches it.
      const body = await c.req.json<UploadInput>();
      try {
        const result = await uploadSnapshot(this.vaultDeps(c.req.raw), body);
        return c.json({ ok: true, ...result });
      } catch (error) {
        if (
          error instanceof RevisionConflictError ||
          error instanceof LeaseConflictError
        ) {
          return c.json({ ok: false, error: error.message }, 409);
        }
        if (error instanceof VaultSyncError)
          return c.json({ ok: false, error: error.message }, 400);
        throw error;
      }
    });
  }

  override async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}
