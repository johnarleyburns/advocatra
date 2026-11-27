// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { bytesToUtf8, utf8ToBytes } from "./bytes.ts";
import { deriveDataKey } from "./derive.ts";
import { decryptBytes, type EnvelopeAad, encryptBytes } from "./envelope.ts";
import { generateVaultMasterKeyMaterial } from "./vault-key.ts";

const aad: EnvelopeAad = { vaultId: "vault-1", purpose: "records", schemaVersion: 1 };

describe("deriveDataKey", () => {
  it("derives independent keys for different purposes from the same master key", async () => {
    const material = generateVaultMasterKeyMaterial();
    const recordsKey = await deriveDataKey(material, "records");
    const documentsKey = await deriveDataKey(material, "documents");

    const plaintext = utf8ToBytes("taxpayer record");
    const envelope = await encryptBytes(recordsKey, plaintext, aad);

    // The documents-purpose key, though derived from the same master key, cannot decrypt it.
    await expect(decryptBytes(documentsKey, envelope, aad)).rejects.toThrow();
    expect(bytesToUtf8(await decryptBytes(recordsKey, envelope, aad))).toBe(
      "taxpayer record",
    );
  });

  it("the same master key and purpose derive a functionally equivalent key", async () => {
    const material = generateVaultMasterKeyMaterial();
    const keyA = await deriveDataKey(material, "records");
    const keyB = await deriveDataKey(material, "records");
    const envelope = await encryptBytes(keyA, utf8ToBytes("hello"), aad);
    expect(bytesToUtf8(await decryptBytes(keyB, envelope, aad))).toBe("hello");
  });
});
