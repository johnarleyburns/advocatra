// SPDX-License-Identifier: AGPL-3.0-only
//
// Orchestrates one tenant's encrypted vault snapshot sync: upload/download
// against R2, revision and lease enforcement via @advocatra/sync. This
// module NEVER decrypts anything — see CLAUDE.md hard limit #7. It treats
// the snapshot as an opaque, already-encrypted envelope; the only thing it
// inspects is `EncryptedEnvelopeSchema`'s metadata (version, algorithm,
// base64 strings) to reject an obviously malformed upload before it's
// written to R2 — never the plaintext, which it has no way to see.

import { type EncryptedEnvelope, EncryptedEnvelopeSchema } from "@advocatra/crypto";
import {
  acquireLease,
  canAcceptUpload,
  canAcquireLease,
  type EditingLease,
  NO_REVISION,
  nextRevision,
} from "@advocatra/sync";
import type { Clock } from "@advocatra/testkit";
import type { SqlExecutor } from "./data-access/auth-store.ts";
import {
  getVaultState,
  saveVaultState,
  type VaultState,
} from "./data-access/vault-store.ts";

export interface ObjectStorePort {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
}

export interface VaultDeps {
  readonly sql: SqlExecutor;
  readonly r2: ObjectStorePort;
  readonly clock: Clock;
  readonly tenantId: string;
}

export class VaultSyncError extends Error {}
export class RevisionConflictError extends VaultSyncError {
  constructor(readonly currentRevision: number) {
    super(
      `upload was based on a stale revision; current revision is ${currentRevision}`,
    );
  }
}
export class LeaseConflictError extends VaultSyncError {
  constructor(readonly heldBy: string) {
    super(`the editing lease is currently held by another device (${heldBy})`);
  }
}

function currentState(sql: SqlExecutor): VaultState {
  return (
    getVaultState(sql) ?? { revision: NO_REVISION, snapshotR2Key: null, lease: null }
  );
}

export interface DownloadResult {
  readonly revision: number;
  readonly snapshot: EncryptedEnvelope | null;
}

/** Download the latest snapshot. `snapshot` is null for a vault that has never been uploaded. */
export async function downloadSnapshot(deps: VaultDeps): Promise<DownloadResult> {
  const state = currentState(deps.sql);
  if (!state.snapshotR2Key) return { revision: state.revision, snapshot: null };
  const object = await deps.r2.get(state.snapshotR2Key);
  if (!object)
    throw new VaultSyncError(
      `snapshot object missing from storage: ${state.snapshotR2Key}`,
    );
  const parsed: unknown = JSON.parse(await object.text());
  return { revision: state.revision, snapshot: EncryptedEnvelopeSchema.parse(parsed) };
}

/** Acquire or renew the editing lease for `deviceId`. Throws LeaseConflictError if another device holds it. */
export function acquireOrRenewLease(deps: VaultDeps, deviceId: string): EditingLease {
  const state = currentState(deps.sql);
  const now = deps.clock.now();
  if (!canAcquireLease(state.lease, deviceId, now)) {
    // state.lease is guaranteed non-null here: canAcquireLease is only
    // false when a lease exists, is unexpired, and belongs to another device.
    throw new LeaseConflictError((state.lease as EditingLease).deviceId);
  }
  const lease = acquireLease(deps.tenantId, deviceId, now);
  saveVaultState(deps.sql, { ...state, lease }, now.toISOString());
  return lease;
}

export interface UploadInput {
  readonly deviceId: string;
  readonly baseRevision: number;
  readonly snapshot: EncryptedEnvelope;
}

export interface UploadResult {
  readonly revision: number;
}

/**
 * Upload a new snapshot revision. Rejects a stale `baseRevision` (no
 * merge, ever — matches TECHNICAL-DESIGN.md §7) and rejects uploading
 * without holding (or being able to acquire) the editing lease.
 */
export async function uploadSnapshot(
  deps: VaultDeps,
  input: UploadInput,
): Promise<UploadResult> {
  const state = currentState(deps.sql);
  const now = deps.clock.now();

  if (!canAcquireLease(state.lease, input.deviceId, now)) {
    throw new LeaseConflictError((state.lease as EditingLease).deviceId);
  }
  if (!canAcceptUpload(state.revision, input.baseRevision)) {
    throw new RevisionConflictError(state.revision);
  }

  const envelope = EncryptedEnvelopeSchema.parse(input.snapshot);
  const revision = nextRevision(state.revision);
  const key = `tenants/${deps.tenantId}/snapshots/${revision}.json`;
  await deps.r2.put(key, JSON.stringify(envelope));

  const lease = acquireLease(deps.tenantId, input.deviceId, now);
  saveVaultState(deps.sql, { revision, snapshotR2Key: key, lease }, now.toISOString());
  return { revision };
}
