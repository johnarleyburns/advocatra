// SPDX-License-Identifier: AGPL-3.0-only
import { FakeClock, FakeIdGenerator, FakeSql } from "@advocatra/testkit";
import { describe, expect, it } from "vitest";
import {
  type AccountDeps,
  AccountError,
  completeSetup,
  createPendingAccount,
  generateTotpSecret,
  logIn,
  logOut,
  validateSession,
} from "./accounts.ts";
import { totpCode } from "./auth.ts";

const TOTP_MASTER_KEY = "dGVzdC1tYXN0ZXIta2V5LWZvci10b3RwLWVuY3J5cHRpb24"; // arbitrary base64url test key

function makeDeps(overrides: Partial<AccountDeps> = {}): AccountDeps {
  return {
    sql: new FakeSql(),
    clock: new FakeClock(new Date("2027-01-01T00:00:00Z")),
    idGen: new FakeIdGenerator(),
    tenantId: "tenant-1",
    ...overrides,
  };
}

describe("createPendingAccount / completeSetup", () => {
  it("lets a fresh setup token set the password", async () => {
    const deps = makeDeps();
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    const { userId } = await completeSetup(deps, {
      setupToken,
      password: "correct horse battery staple",
    });
    expect(userId).toBe("id-1");

    const { sessionToken } = await logIn(deps, {
      email: "jane@example.com",
      password: "correct horse battery staple",
    });
    expect(await validateSession(deps, sessionToken)).toEqual({
      userId: "id-1",
      email: "jane@example.com",
    });
  });

  it("rejects a password shorter than the minimum", async () => {
    const deps = makeDeps();
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    await expect(
      completeSetup(deps, { setupToken, password: "short" }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("rejects reusing a setup token", async () => {
    const deps = makeDeps();
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    await completeSetup(deps, { setupToken, password: "correct horse battery staple" });
    await expect(
      completeSetup(deps, { setupToken, password: "another long password here" }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("rejects an expired setup token", async () => {
    const deps = makeDeps();
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    (deps.clock as FakeClock).advance(25 * 60 * 60 * 1000); // 25h > 24h TTL
    await expect(
      completeSetup(deps, { setupToken, password: "correct horse battery staple" }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("rejects an unknown setup token", async () => {
    const deps = makeDeps();
    await expect(
      completeSetup(deps, {
        setupToken: "not-a-real-token",
        password: "correct horse battery staple",
      }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("rejects enabling TOTP when no master key is configured", async () => {
    const deps = makeDeps(); // no totpMasterKeyBase64 configured
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    await expect(
      completeSetup(deps, {
        setupToken,
        password: "correct horse battery staple",
        totpSecret: generateTotpSecret(),
      }),
    ).rejects.toBeInstanceOf(AccountError);
  });
});

describe("logIn", () => {
  it("rejects an unknown email", async () => {
    const deps = makeDeps();
    await expect(
      logIn(deps, { email: "nobody@example.com", password: "whatever" }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("rejects the wrong password", async () => {
    const deps = makeDeps();
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    await completeSetup(deps, { setupToken, password: "correct horse battery staple" });
    await expect(
      logIn(deps, { email: "jane@example.com", password: "wrong password" }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  it("requires a TOTP code once two-factor is enabled, and validates it", async () => {
    const deps = makeDeps({ totpMasterKeyBase64: TOTP_MASTER_KEY });
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    const totpSecret = generateTotpSecret();
    await completeSetup(deps, {
      setupToken,
      password: "correct horse battery staple",
      totpSecret,
    });

    await expect(
      logIn(deps, {
        email: "jane@example.com",
        password: "correct horse battery staple",
      }),
    ).rejects.toBeInstanceOf(AccountError);
    await expect(
      logIn(deps, {
        email: "jane@example.com",
        password: "correct horse battery staple",
        totpCode: "000000",
      }),
    ).rejects.toBeInstanceOf(AccountError);

    const code = await totpCode(totpSecret, deps.clock.now().getTime());
    const { sessionToken } = await logIn(deps, {
      email: "jane@example.com",
      password: "correct horse battery staple",
      totpCode: code,
    });
    expect(await validateSession(deps, sessionToken)).not.toBeNull();
  });
});

describe("logOut / validateSession", () => {
  it("invalidates the session on logout", async () => {
    const deps = makeDeps();
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    await completeSetup(deps, { setupToken, password: "correct horse battery staple" });
    const { sessionToken } = await logIn(deps, {
      email: "jane@example.com",
      password: "correct horse battery staple",
    });
    expect(await validateSession(deps, sessionToken)).not.toBeNull();
    await logOut(deps, sessionToken);
    expect(await validateSession(deps, sessionToken)).toBeNull();
  });

  it("invalidates the session once it has expired", async () => {
    const deps = makeDeps();
    const { setupToken } = await createPendingAccount(deps, "jane@example.com");
    await completeSetup(deps, { setupToken, password: "correct horse battery staple" });
    const { sessionToken } = await logIn(deps, {
      email: "jane@example.com",
      password: "correct horse battery staple",
    });
    (deps.clock as FakeClock).advance(31 * 24 * 60 * 60 * 1000); // 31 days > 30-day TTL
    expect(await validateSession(deps, sessionToken)).toBeNull();
  });

  it("returns null for a session token that never existed", async () => {
    const deps = makeDeps();
    expect(await validateSession(deps, "bogus-token")).toBeNull();
  });
});
