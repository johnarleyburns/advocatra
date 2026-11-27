// SPDX-License-Identifier: AGPL-3.0-only
import {
  bytesToUtf8,
  deriveDataKey,
  encryptBytes,
  generateVaultMasterKeyMaterial,
  utf8ToBytes,
} from "@advocatra/crypto";
import { describe, expect, it } from "vitest";
import { decryptDocumentObject, encryptDocumentObject } from "./document-object.ts";
import { emptyVaultRecords } from "./records.ts";
import { decryptVaultSnapshot } from "./snapshot.ts";

describe("encryptDocumentObject / decryptDocumentObject", () => {
  it("round-trips document bytes", async () => {
    const material = generateVaultMasterKeyMaterial();
    const envelope = await encryptDocumentObject(
      utf8ToBytes("CP2000 notice PDF bytes"),
      material,
      "vault-1",
    );
    expect(
      bytesToUtf8(await decryptDocumentObject(envelope, material, "vault-1")),
    ).toBe("CP2000 notice PDF bytes");
  });

  it("fails when decrypted under the wrong vaultId (cross-vault replay)", async () => {
    const material = generateVaultMasterKeyMaterial();
    const envelope = await encryptDocumentObject(
      utf8ToBytes("attachment bytes"),
      material,
      "vault-1",
    );
    await expect(
      decryptDocumentObject(envelope, material, "vault-2"),
    ).rejects.toThrow();
  });

  it("uses a key independent from the records key", async () => {
    const material = generateVaultMasterKeyMaterial();
    const documentEnvelope = await encryptDocumentObject(
      utf8ToBytes("attachment bytes"),
      material,
      "vault-1",
    );

    // An envelope encrypted under the "documents" purpose key must not be
    // decryptable as if it were a "records" snapshot.
    await expect(
      decryptVaultSnapshot(documentEnvelope, material, "vault-1"),
    ).rejects.toThrow();

    // And the reverse: a "records" envelope isn't a valid document object either.
    const recordsKey = await deriveDataKey(material, "records");
    const recordsEnvelope = await encryptBytes(
      recordsKey,
      utf8ToBytes(JSON.stringify(emptyVaultRecords())),
      { vaultId: "vault-1", purpose: "records", schemaVersion: 1 },
    );
    await expect(
      decryptDocumentObject(recordsEnvelope, material, "vault-1"),
    ).rejects.toThrow();
  });
});
