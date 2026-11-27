// SPDX-License-Identifier: AGPL-3.0-only
import {
  bytesToUtf8,
  decryptBytes,
  deriveDataKey,
  type EncryptedEnvelope,
  encryptBytes,
  utf8ToBytes,
} from "@advocatra/crypto";
import { type VaultRecords, VaultRecordsSchema } from "./records.ts";

/**
 * Encrypt the vault's records under the "records" purpose key derived from
 * the vault master key. This is the "whole-vault snapshot" TECHNICAL-DESIGN.md
 * §7 describes — large attachments are encrypted separately, see
 * `document-object.ts`.
 */
export async function encryptVaultSnapshot(
  records: VaultRecords,
  masterKeyMaterial: Uint8Array,
): Promise<EncryptedEnvelope> {
  const key = await deriveDataKey(masterKeyMaterial, "records");
  const plaintext = utf8ToBytes(JSON.stringify(records));
  return encryptBytes(key, plaintext);
}

/**
 * Decrypt and validate a vault snapshot. Throws separately distinguishable
 * errors for a cryptographic failure (wrong key, tampered ciphertext — from
 * `decryptBytes`) versus a schema failure (corrupt or incompatible JSON —
 * from `VaultRecordsSchema.parse`), so callers can tell those apart.
 */
export async function decryptVaultSnapshot(
  envelope: EncryptedEnvelope,
  masterKeyMaterial: Uint8Array,
): Promise<VaultRecords> {
  const key = await deriveDataKey(masterKeyMaterial, "records");
  const plaintext = await decryptBytes(key, envelope);
  const parsed: unknown = JSON.parse(bytesToUtf8(plaintext));
  return VaultRecordsSchema.parse(parsed);
}
