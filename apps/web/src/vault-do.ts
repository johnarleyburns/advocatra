// SPDX-License-Identifier: AGPL-3.0-only
//
// One Vault Durable Object per tenant (idFromName(tenantId), resolved by
// the edge layer via KV — see edge/tenant-lookup.ts). This phase only
// wires up account/session routes; the R2-backed encrypted snapshot
// (packages/vault + packages/sync) is a later phase.
//
// HARD RULE: this file, and everything added to it later, must never call
// a decrypt function from @advocatra/crypto or @advocatra/vault. The
// server stores and serves ciphertext only — see this repo's CLAUDE.md
// "non-negotiable security boundary" and TECHNICAL-DESIGN.md §2/§5. The
// account logic below only ever touches email/password/session rows,
// never taxpayer, matter, document or billing data.

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

interface Env {
  TOTP_MASTER_KEY?: string;
}

const MIGRATIONS = [
  "CREATE TABLE IF NOT EXISTS adv_users (id TEXT PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT, totp_secret_encrypted TEXT, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS adv_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS adv_setup_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)",
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

  private deps(request: Request): AccountDeps {
    const tenantId = request.headers.get("X-Advocatra-Tenant-Id") ?? "unknown-tenant";
    return {
      sql: this.sql(),
      clock: { now: () => new Date() },
      idGen: { newId: () => crypto.randomUUID() },
      tenantId,
      ...(this.env.TOTP_MASTER_KEY !== undefined
        ? { totpMasterKeyBase64: this.env.TOTP_MASTER_KEY }
        : {}),
    };
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
  }

  override async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }
}
