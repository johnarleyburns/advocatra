// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import {
  asBufferSource,
  base64ToBytes,
  bytesToBase64,
  randomBytes,
  utf8ToBytes,
} from "./bytes.ts";

/**
 * Versioned, authenticated-encryption envelope. Mirrors TECHNICAL-DESIGN.md
 * §5: AES-256-GCM everywhere, a random nonce per object, versioned metadata
 * so the format can evolve without breaking old vaults.
 *
 * `aad` binds the ciphertext to the record it claims to be (ported from
 * Saldima's shipped `DataEnvelopeV1`/`EnvelopeAad` design, which already
 * solved this): a valid envelope for one vault/revision can't be silently
 * replayed as another, because the caller-supplied AAD is authenticated as
 * part of the AES-GCM tag, not just stored alongside the ciphertext.
 */
export const EnvelopeAadSchema = z.object({
  vaultId: z.string().min(1),
  purpose: z.enum(["records", "documents"]),
  schemaVersion: z.int().positive(),
});
export type EnvelopeAad = z.infer<typeof EnvelopeAadSchema>;

export const EncryptedEnvelopeSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("AES-256-GCM"),
  iv: z.string(),
  ciphertext: z.string(),
  aad: EnvelopeAadSchema,
});
export type EncryptedEnvelope = z.infer<typeof EncryptedEnvelopeSchema>;

const IV_LENGTH_BYTES = 12;

/** Canonical (stable key order) JSON encoding of `aad`, so the authenticated bytes are deterministic. */
function canonicalAad(aad: EnvelopeAad): Uint8Array {
  return utf8ToBytes(
    JSON.stringify({
      vaultId: aad.vaultId,
      purpose: aad.purpose,
      schemaVersion: aad.schemaVersion,
    }),
  );
}

/** Encrypt `plaintext` under `key`, with a fresh random IV, authenticating `aad` as additional data. */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad: EnvelopeAad,
): Promise<EncryptedEnvelope> {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asBufferSource(iv),
      additionalData: asBufferSource(canonicalAad(aad)),
    },
    key,
    asBufferSource(plaintext),
  );
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    aad,
  };
}

/**
 * Decrypt an envelope under `key`. `expectedAad` must match the envelope's
 * own `aad` exactly — checked before any crypto runs, and independently
 * re-authenticated as AES-GCM additional data, so tampering with either the
 * ciphertext or the stored `aad` field (without the key) is detected rather
 * than silently accepted. Also throws if the key is wrong or the ciphertext
 * was tampered with — AES-GCM's authentication tag makes all of these fail
 * the same way, by design.
 */
export async function decryptBytes(
  key: CryptoKey,
  envelope: EncryptedEnvelope,
  expectedAad: EnvelopeAad,
): Promise<Uint8Array> {
  const parsed = EncryptedEnvelopeSchema.parse(envelope);
  if (
    parsed.aad.vaultId !== expectedAad.vaultId ||
    parsed.aad.purpose !== expectedAad.purpose ||
    parsed.aad.schemaVersion !== expectedAad.schemaVersion
  ) {
    throw new Error(
      "envelope aad does not match the expected vault/purpose/schemaVersion",
    );
  }
  const iv = base64ToBytes(parsed.iv);
  const ciphertext = base64ToBytes(parsed.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asBufferSource(iv),
      additionalData: asBufferSource(canonicalAad(expectedAad)),
    },
    key,
    asBufferSource(ciphertext),
  );
  return new Uint8Array(plaintext);
}
