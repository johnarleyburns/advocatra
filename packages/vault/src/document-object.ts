// SPDX-License-Identifier: AGPL-3.0-only
import {
  decryptBytes,
  deriveDataKey,
  type EncryptedEnvelope,
  encryptBytes,
} from "@advocatra/crypto";

/** The document-object schema version bound into the envelope's AAD. */
export const DOCUMENT_SCHEMA_VERSION = 1;

/**
 * Encrypt one document/attachment's bytes under the "documents" purpose
 * key — independent of the "records" key used for `encryptVaultSnapshot`,
 * so a leaked records key never exposes attachment contents and vice versa.
 * The envelope's AAD binds it to `vaultId`, so an attachment from one vault
 * can't be replayed as another's.
 */
export async function encryptDocumentObject(
  bytes: Uint8Array,
  masterKeyMaterial: Uint8Array,
  vaultId: string,
): Promise<EncryptedEnvelope> {
  const key = await deriveDataKey(masterKeyMaterial, "documents");
  return encryptBytes(key, bytes, {
    vaultId,
    purpose: "documents",
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
  });
}

export async function decryptDocumentObject(
  envelope: EncryptedEnvelope,
  masterKeyMaterial: Uint8Array,
  vaultId: string,
): Promise<Uint8Array> {
  const key = await deriveDataKey(masterKeyMaterial, "documents");
  return decryptBytes(key, envelope, {
    vaultId,
    purpose: "documents",
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
  });
}
