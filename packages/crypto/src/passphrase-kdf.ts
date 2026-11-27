// SPDX-License-Identifier: AGPL-3.0-only
import { asBufferSource, utf8ToBytes } from "./bytes.ts";

/**
 * PBKDF2 iteration count for deriving the key-encryption key (KEK) from a
 * user passphrase. TECHNICAL-DESIGN.md §5/§9 prefers an audited Argon2id
 * implementation where practically available; this is the documented
 * fallback using Web Crypto's native PBKDF2, not an invented scheme.
 * 600,000 matches current (2023+) OWASP guidance for PBKDF2-HMAC-SHA256.
 */
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;

/**
 * Derive a non-extractable AES-KW key-encryption key from a passphrase and
 * salt. The KEK is used only to wrap/unwrap the vault master key — it is
 * never used to encrypt taxpayer data directly.
 */
export async function deriveKeyEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    asBufferSource(utf8ToBytes(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}
