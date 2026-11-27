// SPDX-License-Identifier: AGPL-3.0-only
import {
  decryptBytes,
  deriveDataKey,
  type EncryptedEnvelope,
  encryptBytes,
} from "@advocatra/crypto";

/**
 * Encrypt one document/attachment's bytes under the "documents" purpose
 * key — independent of the "records" key used for `encryptVaultSnapshot`,
 * so a leaked records key never exposes attachment contents and vice versa.
 */
export async function encryptDocumentObject(
  bytes: Uint8Array,
  masterKeyMaterial: Uint8Array,
): Promise<EncryptedEnvelope> {
  const key = await deriveDataKey(masterKeyMaterial, "documents");
  return encryptBytes(key, bytes);
}

export async function decryptDocumentObject(
  envelope: EncryptedEnvelope,
  masterKeyMaterial: Uint8Array,
): Promise<Uint8Array> {
  const key = await deriveDataKey(masterKeyMaterial, "documents");
  return decryptBytes(key, envelope);
}
