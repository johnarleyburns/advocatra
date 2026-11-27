// SPDX-License-Identifier: AGPL-3.0-only
import type { EncryptedEnvelope } from "@advocatra/crypto";
import { FakeClock, FakeObjectStore, FakeSql } from "@advocatra/testkit";
import { describe, expect, it } from "vitest";
import {
  acquireOrRenewLease,
  downloadSnapshot,
  LeaseConflictError,
  RevisionConflictError,
  uploadSnapshot,
  type VaultDeps,
} from "./vault.ts";

function makeDeps(overrides: Partial<VaultDeps> = {}): VaultDeps {
  return {
    sql: new FakeSql(),
    r2: new FakeObjectStore(),
    clock: new FakeClock(new Date("2027-01-01T00:00:00Z")),
    tenantId: "tenant-1",
    ...overrides,
  };
}

const sampleEnvelope: EncryptedEnvelope = {
  version: 1,
  algorithm: "AES-256-GCM",
  iv: "aaaaaaaaaaaaaaaaaaaa",
  ciphertext: "bbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  aad: { vaultId: "tenant-1", purpose: "records", schemaVersion: 1 },
};

describe("downloadSnapshot", () => {
  it("returns no snapshot for a vault that has never been uploaded", async () => {
    const result = await downloadSnapshot(makeDeps());
    expect(result).toEqual({ revision: 0, snapshot: null });
  });
});

describe("uploadSnapshot", () => {
  it("accepts the first upload (baseRevision 0) and stores it in R2", async () => {
    const deps = makeDeps();
    const result = await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 0,
      snapshot: sampleEnvelope,
    });
    expect(result.revision).toBe(1);

    const download = await downloadSnapshot(deps);
    expect(download).toEqual({ revision: 1, snapshot: sampleEnvelope });
    expect((deps.r2 as FakeObjectStore).has("tenants/tenant-1/snapshots/1.json")).toBe(
      true,
    );
  });

  it("rejects an upload based on a stale revision", async () => {
    const deps = makeDeps();
    await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 0,
      snapshot: sampleEnvelope,
    });
    await expect(
      uploadSnapshot(deps, {
        deviceId: "device-a",
        baseRevision: 0,
        snapshot: sampleEnvelope,
      }),
    ).rejects.toBeInstanceOf(RevisionConflictError);
  });

  it("accepts a second upload based on the now-current revision", async () => {
    const deps = makeDeps();
    await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 0,
      snapshot: sampleEnvelope,
    });
    const result = await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 1,
      snapshot: sampleEnvelope,
    });
    expect(result.revision).toBe(2);
  });

  it("rejects a malformed snapshot", async () => {
    const deps = makeDeps();
    await expect(
      uploadSnapshot(deps, {
        deviceId: "device-a",
        baseRevision: 0,
        snapshot: { version: 1 } as unknown as EncryptedEnvelope,
      }),
    ).rejects.toThrow();
  });

  it("rejects an upload from a different device while the lease is held", async () => {
    const deps = makeDeps();
    await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 0,
      snapshot: sampleEnvelope,
    });
    await expect(
      uploadSnapshot(deps, {
        deviceId: "device-b",
        baseRevision: 1,
        snapshot: sampleEnvelope,
      }),
    ).rejects.toBeInstanceOf(LeaseConflictError);
  });

  it("allows a second upload from the same device (lease renewal)", async () => {
    const deps = makeDeps();
    await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 0,
      snapshot: sampleEnvelope,
    });
    const result = await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 1,
      snapshot: sampleEnvelope,
    });
    expect(result.revision).toBe(2);
  });

  it("allows another device once the lease has expired", async () => {
    const clock = new FakeClock(new Date("2027-01-01T00:00:00Z"));
    const deps = makeDeps({ clock });
    await uploadSnapshot(deps, {
      deviceId: "device-a",
      baseRevision: 0,
      snapshot: sampleEnvelope,
    });
    clock.advance(10 * 60 * 1000); // past the 5-minute default lease
    const result = await uploadSnapshot(deps, {
      deviceId: "device-b",
      baseRevision: 1,
      snapshot: sampleEnvelope,
    });
    expect(result.revision).toBe(2);
  });
});

describe("acquireOrRenewLease", () => {
  it("lets a second device acquire once the first device's lease expires", () => {
    const clock = new FakeClock(new Date("2027-01-01T00:00:00Z"));
    const deps = makeDeps({ clock });
    acquireOrRenewLease(deps, "device-a");
    expect(() => acquireOrRenewLease(deps, "device-b")).toThrow(LeaseConflictError);
    clock.advance(10 * 60 * 1000);
    expect(() => acquireOrRenewLease(deps, "device-b")).not.toThrow();
  });
});
