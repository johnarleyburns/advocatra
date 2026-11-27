// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

/**
 * A stored snapshot revision, per TECHNICAL-DESIGN.md §7: whole-vault
 * snapshots, each carrying a monotonic revision number. `encryptedSnapshotRef`
 * is an opaque pointer into object storage (e.g. an R2 key) — this package
 * never touches the ciphertext itself, only the revision bookkeeping.
 */
export const SnapshotRevisionSchema = z.object({
  vaultId: z.string().min(1),
  revision: z.int().positive(),
  formatVersion: z.literal(1),
  encryptedSnapshotRef: z.string().min(1),
  uploadedAt: z.iso.datetime(),
  sizeBytes: z.int().nonnegative(),
});
export type SnapshotRevision = z.infer<typeof SnapshotRevisionSchema>;

/** The revision number for a vault that has never been uploaded. */
export const NO_REVISION = 0;

/** The revision number an upload should be stored as, given what's there now. */
export function nextRevision(currentRevision: number): number {
  return currentRevision + 1;
}

/**
 * Whether an upload claiming to be based on `uploadBasedOnRevision` may be
 * accepted, given the server's `currentRevision`. Per TECHNICAL-DESIGN.md §7:
 * "the server rejects an upload based on a stale revision rather than
 * merging it" — no automatic merge, ever, in this design.
 */
export function canAcceptUpload(
  currentRevision: number,
  uploadBasedOnRevision: number,
): boolean {
  return uploadBasedOnRevision === currentRevision;
}
