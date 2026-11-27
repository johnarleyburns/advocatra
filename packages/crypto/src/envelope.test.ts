// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "./bytes.ts";
import { deriveDataKey } from "./derive.ts";
import {
  decryptBytes,
  EncryptedEnvelopeSchema,
  type EnvelopeAad,
  encryptBytes,
} from "./envelope.ts";
import { generateVaultMasterKeyMaterial } from "./vault-key.ts";

async function testKey(): Promise<CryptoKey> {
  return deriveDataKey(generateVaultMasterKeyMaterial(), "documents");
}

const aad: EnvelopeAad = { vaultId: "vault-1", purpose: "documents", schemaVersion: 1 };

describe("encryptBytes / decryptBytes", () => {
  it("round-trips plaintext", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(
      key,
      utf8ToBytes("CP2000 notice, tax year 2026"),
      aad,
    );
    expect(bytesToUtf8(await decryptBytes(key, envelope, aad))).toBe(
      "CP2000 notice, tax year 2026",
    );
  });

  it("produces a different ciphertext and IV each time, even for the same plaintext", async () => {
    const key = await testKey();
    const plaintext = utf8ToBytes("same plaintext every time");
    const a = await encryptBytes(key, plaintext, aad);
    const b = await encryptBytes(key, plaintext, aad);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("produces an envelope matching the versioned schema, carrying the aad", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("x"), aad);
    expect(() => EncryptedEnvelopeSchema.parse(envelope)).not.toThrow();
    expect(envelope.version).toBe(1);
    expect(envelope.algorithm).toBe("AES-256-GCM");
    expect(envelope.aad).toEqual(aad);
  });

  it("fails to decrypt under the wrong key", async () => {
    const key = await testKey();
    const wrongKey = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"), aad);
    await expect(decryptBytes(wrongKey, envelope, aad)).rejects.toThrow();
  });

  it("fails to decrypt a tampered ciphertext (authentication, not just confidentiality)", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"), aad);
    const tamperedBytes = base64ToBytes(envelope.ciphertext);
    tamperedBytes[0] = (tamperedBytes[0] ?? 0) ^ 0xff;
    const tampered = { ...envelope, ciphertext: bytesToBase64(tamperedBytes) };
    await expect(decryptBytes(key, tampered, aad)).rejects.toThrow();
  });

  it("fails to decrypt with a tampered IV", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"), aad);
    const tamperedIv = base64ToBytes(envelope.iv);
    tamperedIv[0] = (tamperedIv[0] ?? 0) ^ 0xff;
    const tampered = { ...envelope, iv: bytesToBase64(tamperedIv) };
    await expect(decryptBytes(key, tampered, aad)).rejects.toThrow();
  });

  it("rejects decrypting with a different expected vaultId (replay across vaults)", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"), aad);
    await expect(
      decryptBytes(key, envelope, { ...aad, vaultId: "vault-2" }),
    ).rejects.toThrow(/aad/);
  });

  it("rejects decrypting with a different expected purpose (replay across purposes)", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"), aad);
    await expect(
      decryptBytes(key, envelope, { ...aad, purpose: "records" }),
    ).rejects.toThrow(/aad/);
  });

  it("rejects an envelope whose stored aad was tampered to match a forged expectation", async () => {
    const key = await testKey();
    const envelope = await encryptBytes(key, utf8ToBytes("secret"), aad);
    const forgedAad: EnvelopeAad = { ...aad, vaultId: "vault-2" };
    const tampered = { ...envelope, aad: forgedAad };
    // The stored aad now matches forgedAad structurally, but the AES-GCM tag
    // was computed over the original aad, so re-authenticating against the
    // (matching, forged) expectation still fails — the swap is detected.
    await expect(decryptBytes(key, tampered, forgedAad)).rejects.toThrow();
  });
});
