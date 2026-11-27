// SPDX-License-Identifier: AGPL-3.0-only
import { FakeSql } from "@advocatra/testkit";
import { describe, expect, it } from "vitest";
import { getVaultState, saveVaultState } from "./vault-store.ts";

describe("vault-store", () => {
  it("returns null before any state has been saved", () => {
    expect(getVaultState(new FakeSql())).toBeNull();
  });

  it("round-trips a state with no lease", () => {
    const sql = new FakeSql();
    saveVaultState(
      sql,
      { revision: 1, snapshotR2Key: "tenants/t1/snapshots/1.json", lease: null },
      "2027-01-01T00:00:00Z",
    );
    expect(getVaultState(sql)).toEqual({
      revision: 1,
      snapshotR2Key: "tenants/t1/snapshots/1.json",
      lease: null,
    });
  });

  it("round-trips a state with an active lease", () => {
    const sql = new FakeSql();
    const lease = {
      vaultId: "t1",
      deviceId: "device-a",
      acquiredAt: "2027-01-01T00:00:00Z",
      expiresAt: "2027-01-01T00:05:00Z",
    };
    saveVaultState(
      sql,
      { revision: 2, snapshotR2Key: "key-2", lease },
      "2027-01-01T00:00:00Z",
    );
    expect(getVaultState(sql)).toEqual({ revision: 2, snapshotR2Key: "key-2", lease });
  });

  it("updates in place on a second save (insert-or-update)", () => {
    const sql = new FakeSql();
    saveVaultState(
      sql,
      { revision: 1, snapshotR2Key: "key-1", lease: null },
      "2027-01-01T00:00:00Z",
    );
    saveVaultState(
      sql,
      { revision: 2, snapshotR2Key: "key-2", lease: null },
      "2027-01-02T00:00:00Z",
    );
    expect(getVaultState(sql)).toEqual({
      revision: 2,
      snapshotR2Key: "key-2",
      lease: null,
    });
  });
});
