// SPDX-License-Identifier: AGPL-3.0-only
import { asBufferSource, utf8ToBytes } from "./bytes.ts";

/**
 * Purposes a data key can be derived for. Each gets its own HKDF `info`
 * string so a records-index key and a documents key are cryptographically
 * independent even though both come from the same vault master key.
 */
export type DataKeyPurpose = "records" | "documents";

/**
 * Derive a per-purpose AES-256-GCM data key from the vault master key
 * material via HKDF-SHA256. The salt is intentionally empty: the master key
 * material is already a full-entropy 256-bit random value (see
 * `generateVaultMasterKeyMaterial`), which is the case HKDF's own spec
 * allows an empty salt for.
 */
export async function deriveDataKey(
  masterKeyMaterial: Uint8Array,
  purpose: DataKeyPurpose,
): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    asBufferSource(masterKeyMaterial),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: asBufferSource(new Uint8Array(0)),
      info: asBufferSource(utf8ToBytes(purpose)),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
