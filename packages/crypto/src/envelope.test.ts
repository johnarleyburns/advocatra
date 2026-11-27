// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "./bytes.ts";
import { deriveDataKey } from "./derive.ts";
import { decryptBytes, EncryptedEnvelopeSchema, encryptBytes } from "./envelope.ts";
import { generateVaultMasterKeyMaterial } from "./vault-key.ts";

async function testKey(): Promise<CryptoKey> {
  return deriveDataKey(generateVaultMasterKeyMaterial(), "documents");
}

describe("encryptBytes / decryptBytes", () => {
  it("round-trips plaintext", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(
      key,
      utf8ToBytes("CP2000 notice, tax year 2026"),
    );
    expect(bytesToUtf8(await decryptBytes(key, envelope))).toBe(
      "CP2000 notice, tax year 2026",
    );
  });

  it("produces a different ciphertext and IV each time, even for the same plaintext", async () => {
    const key = await testKey();
    const plaintext = utf8ToBytes("same plaintext every time");
    const a = await encryptBytes(key, plaintext);
    const b = await encryptBytes(key, plaintext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("produces an envelope matching the versioned schema", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("x"));
    expect(() => EncryptedEnvelopeSchema.parse(envelope)).not.toThrow();
    expect(envelope.version).toBe(1);
    expect(envelope.algorithm).toBe("AES-256-GCM");
  });

  it("fails to decrypt under the wrong key", async () => {
    const key = await testKey();
    const wrongKey = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"));
    await expect(decryptBytes(wrongKey, envelope)).rejects.toThrow();
  });

  it("fails to decrypt a tampered ciphertext (authentication, not just confidentiality)", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"));
    const tamperedBytes = base64ToBytes(envelope.ciphertext);
    tamperedBytes[0] = (tamperedBytes[0] ?? 0) ^ 0xff;
    const tampered = { ...envelope, ciphertext: bytesToBase64(tamperedBytes) };
    await expect(decryptBytes(key, tampered)).rejects.toThrow();
  });

  it("fails to decrypt with a tampered IV", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"));
    const tamperedIv = base64ToBytes(envelope.iv);
    tamperedIv[0] = (tamperedIv[0] ?? 0) ^ 0xff;
    const tampered = { ...envelope, iv: bytesToBase64(tamperedIv) };
    await expect(decryptBytes(key, tampered)).rejects.toThrow();
  });
});
