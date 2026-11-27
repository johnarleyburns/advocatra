// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { createVaultManifest } from "./manifest.ts";

describe("createVaultManifest", () => {
  it("sets the fixed format/schema/encryption fields", () => {
    const manifest = createVaultManifest({
      vaultId: "vault-1",
      appVersion: "0.1.0",
      createdAt: "2027-01-01T00:00:00Z",
    });
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.encryptionAlgorithm).toBe("AES-256-GCM");
    expect(manifest.lastSyncedRevision).toBeUndefined();
  });

  it("rejects an empty vaultId", () => {
    expect(() =>
      createVaultManifest({
        vaultId: "",
        appVersion: "0.1.0",
        createdAt: "2027-01-01T00:00:00Z",
      }),
    ).toThrow();
  });
});
