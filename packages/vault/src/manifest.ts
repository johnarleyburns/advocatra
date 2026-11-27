// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

/**
 * The vault master key, wrapped two independent ways — a passphrase-derived
 * KEK and a recovery-code-derived KEK — so either secret alone unlocks the
 * vault. Ported from Saldima's shipped `KeyEnvelopeDocument` design (see
 * `apps/web/src/client/vault.ts` there). The server only ever stores this
 * wrapped form; it has no way to derive either KEK itself.
 */
export const KeyEnvelopeSchema = z.object({
  version: z.literal(1),
  passphrase: z.object({
    kdf: z.literal("PBKDF2-SHA256"),
    iterations: z.int().positive(),
    saltBase64: z.string().min(1),
    wrappedMasterKeyBase64: z.string().min(1),
  }),
  recovery: z.object({
    wrappedMasterKeyBase64: z.string().min(1),
  }),
});
export type KeyEnvelope = z.infer<typeof KeyEnvelopeSchema>;

/**
 * The vault manifest, per TECHNICAL-DESIGN.md §3: format version, app
 * version, schema version, encryption algorithm id, vault id, the key
 * envelope, and the last synced revision. The document index itself lives
 * in `VaultRecords.documents` (`packages/case`'s `CaseDocument[]`) rather
 * than being duplicated here.
 */
export const VaultManifestSchema = z.object({
  formatVersion: z.literal(1),
  vaultId: z.string().min(1),
  appVersion: z.string().min(1),
  schemaVersion: z.literal(1),
  encryptionAlgorithm: z.literal("AES-256-GCM"),
  createdAt: z.iso.datetime(),
  keyEnvelope: KeyEnvelopeSchema,
  /** Absent for a vault that has never been synced to the cloud. */
  lastSyncedRevision: z.int().nonnegative().optional(),
});
export type VaultManifest = z.infer<typeof VaultManifestSchema>;

export function createVaultManifest(input: {
  vaultId: string;
  appVersion: string;
  createdAt: string;
  keyEnvelope: KeyEnvelope;
}): VaultManifest {
  return VaultManifestSchema.parse({
    formatVersion: 1,
    schemaVersion: 1,
    encryptionAlgorithm: "AES-256-GCM",
    ...input,
  });
}
