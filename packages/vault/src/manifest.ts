// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

/**
 * The vault manifest, per TECHNICAL-DESIGN.md §3: format version, app
 * version, schema version, encryption algorithm id, vault id, and the last
 * synced revision. The document index itself lives in `VaultRecords.documents`
 * (`packages/case`'s `CaseDocument[]`) rather than being duplicated here.
 */
export const VaultManifestSchema = z.object({
  formatVersion: z.literal(1),
  vaultId: z.string().min(1),
  appVersion: z.string().min(1),
  schemaVersion: z.literal(1),
  encryptionAlgorithm: z.literal("AES-256-GCM"),
  createdAt: z.iso.datetime(),
  /** Absent for a vault that has never been synced to the cloud. */
  lastSyncedRevision: z.int().nonnegative().optional(),
});
export type VaultManifest = z.infer<typeof VaultManifestSchema>;

export function createVaultManifest(input: {
  vaultId: string;
  appVersion: string;
  createdAt: string;
}): VaultManifest {
  return VaultManifestSchema.parse({
    formatVersion: 1,
    schemaVersion: 1,
    encryptionAlgorithm: "AES-256-GCM",
    ...input,
  });
}
