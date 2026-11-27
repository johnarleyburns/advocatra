// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptTotpSecret,
  encryptTotpSecret,
  escapeHtml,
  hashPassword,
  MIN_PASSWORD_LENGTH,
  newSessionToken,
  newTotpSecret,
  PASSWORD_ITERATIONS,
  readCookie,
  sessionCookie,
  sessionCookieName,
  timingSafeEqual,
  totpCode,
  verifyPassword,
  verifyTotp,
} from "./auth.ts";

describe("password hashing", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password entirely", hash)).toBe(false);
  });

  it("stays within Cloudflare Workers' WebCrypto PBKDF2 iteration cap", () => {
    expect(PASSWORD_ITERATIONS).toBeLessThanOrEqual(100_000);
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});

describe("session tokens and cookies", () => {
  it("generates a unique, non-empty token each time", async () => {
    const a = await newSessionToken();
    const b = await newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("uses the __Host- prefix only when secure", () => {
    expect(sessionCookieName(true)).toBe("__Host-advocatra_session");
    expect(sessionCookieName(false)).toBe("advocatra_session");
  });

  it("round-trips a cookie value through readCookie", () => {
    const cookie = sessionCookie("advocatra_session", "abc123", false);
    const header = cookie.split(";")[0];
    expect(readCookie(header ?? null, "advocatra_session")).toBe("abc123");
  });

  it("returns null for a missing cookie", () => {
    expect(readCookie("other=value", "advocatra_session")).toBeNull();
  });
});

describe("TOTP", () => {
  it("validates a code generated at the same time window", async () => {
    const secret = newTotpSecret();
    const now = Date.UTC(2027, 0, 1, 0, 0, 0);
    const code = await totpCode(secret, now);
    expect(await verifyTotp(secret, code, now)).toBe(true);
  });

  it("rejects a code far outside the time window", async () => {
    const secret = newTotpSecret();
    const now = Date.UTC(2027, 0, 1, 0, 0, 0);
    const code = await totpCode(secret, now);
    const muchLater = now + 10 * 60 * 1000; // 10 minutes later
    expect(await verifyTotp(secret, code, muchLater)).toBe(false);
  });

  it("rejects a non-6-digit code", async () => {
    const secret = newTotpSecret();
    expect(await verifyTotp(secret, "12", Date.now())).toBe(false);
  });

  it("encrypts and decrypts a TOTP secret round trip", async () => {
    const masterKey = base32Encode(new Uint8Array(32)).slice(0, 43); // arbitrary base64url-ish test key
    const secret = newTotpSecret();
    const encrypted = await encryptTotpSecret(masterKey, "tenant-1", secret);
    expect(await decryptTotpSecret(masterKey, "tenant-1", encrypted)).toBe(secret);
  });

  it("fails to decrypt a TOTP secret under a different tenant id", async () => {
    const masterKey = base32Encode(new Uint8Array(32)).slice(0, 43);
    const secret = newTotpSecret();
    const encrypted = await encryptTotpSecret(masterKey, "tenant-1", secret);
    await expect(decryptTotpSecret(masterKey, "tenant-2", encrypted)).rejects.toThrow();
  });
});

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 250, 251, 252, 253, 254, 255]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });
});

describe("timingSafeEqual", () => {
  it("is false for different lengths", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(
      false,
    );
  });

  it("is true for identical bytes", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(
      true,
    );
  });
});

describe("escapeHtml", () => {
  it("escapes the five reserved characters", () => {
    expect(escapeHtml(`<a href="x">it's & done</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; done&lt;/a&gt;",
    );
  });
});

describe("MIN_PASSWORD_LENGTH", () => {
  it("is a sane positive minimum", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8);
  });
});
