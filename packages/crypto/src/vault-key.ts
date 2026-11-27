// SPDX-License-Identifier: AGPL-3.0-only
import { asBufferSource, randomBytes } from "./bytes.ts";

/** A fresh, random 256-bit vault master key, as raw key material (not yet a typed CryptoKey). */
export function generateVaultMasterKeyMaterial(): Uint8Array {
  return randomBytes(32);
}

const WRAP_IV_LENGTH_BYTES = 12;

/**
 * Wrap the vault master key material under a key-encryption key (KEK), so it
 * can be stored or transmitted without ever leaving the client unencrypted.
 *
 * AES-GCM, not AES-KW: see `passphrase-kdf.ts`'s `deriveKeyEncryptionKey`
 * for why (cross-platform interop — CryptoKit has no AES-KW). The output is
 * `iv || ciphertext+tag`, the same layout as Web Crypto's/CryptoKit's own
 * "combined" AES-GCM representation — nothing invented here.
 */
export async function wrapVaultMasterKeyMaterial(
  material: Uint8Array,
  kek: CryptoKey,
): Promise<Uint8Array> {
  const iv = randomBytes(WRAP_IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    kek,
    asBufferSource(material),
  );
  const wrapped = new Uint8Array(iv.length + ciphertext.byteLength);
  wrapped.set(iv, 0);
  wrapped.set(new Uint8Array(ciphertext), iv.length);
  return wrapped;
}

/** Unwrap the vault master key material, given the wrapping KEK. */
export async function unwrapVaultMasterKeyMaterial(
  wrapped: Uint8Array,
  kek: CryptoKey,
): Promise<Uint8Array> {
  const iv = wrapped.slice(0, WRAP_IV_LENGTH_BYTES);
  const ciphertext = wrapped.slice(WRAP_IV_LENGTH_BYTES);
  const material = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    kek,
    asBufferSource(ciphertext),
  );
  return new Uint8Array(material);
}
