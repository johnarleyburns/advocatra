// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

/**
 * A single active-editing lease per vault, per TECHNICAL-DESIGN.md §7: "a
 * second device opens read-only until the lease is released." A lease
 * expires on its own (no explicit release call required) so a crashed or
 * closed client can't lock other devices out indefinitely.
 */
export const EditingLeaseSchema = z.object({
  vaultId: z.string().min(1),
  deviceId: z.string().min(1),
  acquiredAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type EditingLease = z.infer<typeof EditingLeaseSchema>;

/**
 * Default lease duration. An operational parameter, not a cryptographic or
 * data-format decision — easy to tune later without touching the vault
 * format. The client is expected to renew (re-acquire) well before this
 * elapses while actively editing.
 */
export const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000;

export function isLeaseExpired(lease: EditingLease, now: Date): boolean {
  return now.getTime() >= new Date(lease.expiresAt).getTime();
}

/**
 * Whether `requestingDeviceId` may acquire the editing lease right now:
 * true if there is no current lease, the current lease has expired, or the
 * current lease already belongs to the same device (a renewal).
 */
export function canAcquireLease(
  currentLease: EditingLease | null,
  requestingDeviceId: string,
  now: Date,
): boolean {
  if (currentLease === null) return true;
  if (isLeaseExpired(currentLease, now)) return true;
  return currentLease.deviceId === requestingDeviceId;
}

/** Construct a fresh lease. Callers should check `canAcquireLease` first. */
export function acquireLease(
  vaultId: string,
  deviceId: string,
  now: Date,
  durationMs: number = DEFAULT_LEASE_DURATION_MS,
): EditingLease {
  return EditingLeaseSchema.parse({
    vaultId,
    deviceId,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + durationMs).toISOString(),
  });
}
