// SPDX-License-Identifier: AGPL-3.0-only
//
// Pure SQL-shaped helpers for one tenant's vault sync state: the current
// revision number, the R2 key of its latest snapshot, and the active
// editing lease (if any). This table never holds taxpayer/case/billing
// data — only coordination metadata. See data-access/auth-store.ts for
// the shared SqlExecutor shape.

import type { EditingLease } from "@advocatra/sync";
import type { SqlExecutor } from "./auth-store.ts";

const SINGLETON_ID = "singleton";

export interface VaultState {
  revision: number;
  snapshotR2Key: string | null;
  lease: EditingLease | null;
}

interface VaultStateRow {
  id: string;
  revision: number;
  snapshot_r2_key: string | null;
  lease_json: string | null;
  updated_at: string;
}

export function getVaultState(sql: SqlExecutor): VaultState | null {
  const rows = sql
    .exec("SELECT * FROM adv_vault_state WHERE id = ?", SINGLETON_ID)
    .toArray();
  const row = rows[0] as VaultStateRow | undefined;
  if (!row) return null;
  return {
    revision: row.revision,
    snapshotR2Key: row.snapshot_r2_key,
    lease: row.lease_json ? (JSON.parse(row.lease_json) as EditingLease) : null,
  };
}

export function saveVaultState(
  sql: SqlExecutor,
  state: VaultState,
  updatedAt: string,
): void {
  const leaseJson = state.lease ? JSON.stringify(state.lease) : null;
  if (getVaultState(sql) === null) {
    sql.exec(
      "INSERT INTO adv_vault_state (id, revision, snapshot_r2_key, lease_json, updated_at) VALUES (?, ?, ?, ?, ?)",
      SINGLETON_ID,
      state.revision,
      state.snapshotR2Key,
      leaseJson,
      updatedAt,
    );
    return;
  }
  sql.exec(
    "UPDATE adv_vault_state SET revision = ?, snapshot_r2_key = ?, lease_json = ?, updated_at = ? WHERE id = ?",
    state.revision,
    state.snapshotR2Key,
    leaseJson,
    updatedAt,
    SINGLETON_ID,
  );
}
