// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { asBufferSource, base64ToBytes, bytesToBase64, randomBytes } from "./bytes.ts";

/**
 * Versioned, authenticated-encryption envelope. Mirrors TECHNICAL-DESIGN.md
 * §5: AES-256-GCM everywhere, a random nonce per object, versioned metadata
 * so the format can evolve without breaking old vaults.
 */
export const EncryptedEnvelopeSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("AES-256-GCM"),
  iv: z.string(),
  ciphertext: z.string(),
});
export type EncryptedEnvelope = z.infer<typeof EncryptedEnvelopeSchema>;

const IV_LENGTH_BYTES = 12;

/** Encrypt `plaintext` under `key`, with a fresh random IV. */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<EncryptedEnvelope> {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    asBufferSource(plaintext),
  );
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt an envelope under `key`. Throws if the key is wrong or the
 * ciphertext was tampered with — AES-GCM's authentication tag makes both
 * cases fail the same way, by design.
 */
export async function decryptBytes(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
): Promise<Uint8Array> {
  const parsed = EncryptedEnvelopeSchema.parse(envelope);
  const iv = base64ToBytes(parsed.iv);
  const ciphertext = base64ToBytes(parsed.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    asBufferSource(ciphertext),
  );
  return new Uint8Array(plaintext);
}
