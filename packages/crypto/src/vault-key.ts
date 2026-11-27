// SPDX-License-Identifier: AGPL-3.0-only
import { asBufferSource, randomBytes } from "./bytes.ts";

/** A fresh, random 256-bit vault master key, as raw key material (not yet a typed CryptoKey). */
export function generateVaultMasterKeyMaterial(): Uint8Array {
  return randomBytes(32);
}

/**
 * Wrap the vault master key material under a key-encryption key (KEK), so it
 * can be stored or transmitted without ever leaving the client unencrypted.
 */
export async function wrapVaultMasterKeyMaterial(
  material: Uint8Array,
  kek: CryptoKey,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    asBufferSource(material),
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const wrapped = await crypto.subtle.wrapKey("raw", key, kek, "AES-KW");
  return new Uint8Array(wrapped);
}

/** Unwrap the vault master key material, given the wrapping KEK. */
export async function unwrapVaultMasterKeyMaterial(
  wrapped: Uint8Array,
  kek: CryptoKey,
): Promise<Uint8Array> {
  const key = await crypto.subtle.unwrapKey(
    "raw",
    asBufferSource(wrapped),
    kek,
    "AES-KW",
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const material = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(material);
}
