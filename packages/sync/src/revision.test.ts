// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  canAcceptUpload,
  NO_REVISION,
  nextRevision,
  SnapshotRevisionSchema,
} from "./revision.ts";

describe("canAcceptUpload", () => {
  it("accepts the first upload to a vault that has never been uploaded", () => {
    expect(canAcceptUpload(NO_REVISION, NO_REVISION)).toBe(true);
  });

  it("accepts an upload based on the server's current revision", () => {
    expect(canAcceptUpload(5, 5)).toBe(true);
  });

  it("rejects an upload based on a stale revision — scenario from §7", () => {
    // Desktop downloads rev 10, uploads rev 11; phone still thinks it's at rev 10.
    expect(canAcceptUpload(11, 10)).toBe(false);
  });

  it("rejects an upload claiming to be ahead of the server (shouldn't happen, but no merge either way)", () => {
    expect(canAcceptUpload(5, 6)).toBe(false);
  });
});

describe("nextRevision", () => {
  it("is 1 after no revision", () => {
    expect(nextRevision(NO_REVISION)).toBe(1);
  });

  it("increments monotonically", () => {
    expect(nextRevision(11)).toBe(12);
  });
});

describe("SnapshotRevisionSchema", () => {
  it("accepts a well-formed revision record", () => {
    const revision = SnapshotRevisionSchema.parse({
      vaultId: "vault-1",
      revision: 1,
      formatVersion: 1,
      encryptedSnapshotRef: "tenants/vault-1/snapshots/1.enc",
      uploadedAt: "2027-01-01T00:00:00Z",
      sizeBytes: 4096,
    });
    expect(revision.revision).toBe(1);
  });

  it("rejects revision 0 (reserved for 'no revision yet')", () => {
    expect(() =>
      SnapshotRevisionSchema.parse({
        vaultId: "vault-1",
        revision: 0,
        formatVersion: 1,
        encryptedSnapshotRef: "x",
        uploadedAt: "2027-01-01T00:00:00Z",
        sizeBytes: 0,
      }),
    ).toThrow();
  });
});
