// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { createVaultManifest, type KeyEnvelope } from "./manifest.ts";

const sampleKeyEnvelope: KeyEnvelope = {
  version: 1,
  passphrase: {
    kdf: "PBKDF2-SHA256",
    iterations: 600_000,
    saltBase64: "c2FsdA==",
    wrappedMasterKeyBase64: "d3JhcHBlZA==",
  },
  recovery: { wrappedMasterKeyBase64: "d3JhcHBlZC1yZWNvdmVyeQ==" },
};

describe("createVaultManifest", () => {
  it("sets the fixed format/schema/encryption fields", () => {
    const manifest = createVaultManifest({
      vaultId: "vault-1",
      appVersion: "0.1.0",
      createdAt: "2027-01-01T00:00:00Z",
      keyEnvelope: sampleKeyEnvelope,
    });
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.encryptionAlgorithm).toBe("AES-256-GCM");
    expect(manifest.lastSyncedRevision).toBeUndefined();
    expect(manifest.keyEnvelope).toEqual(sampleKeyEnvelope);
  });

  it("rejects an empty vaultId", () => {
    expect(() =>
      createVaultManifest({
        vaultId: "",
        appVersion: "0.1.0",
        createdAt: "2027-01-01T00:00:00Z",
        keyEnvelope: sampleKeyEnvelope,
      }),
    ).toThrow();
  });

  it("rejects a manifest with no key envelope", () => {
    expect(() =>
      createVaultManifest({
        vaultId: "vault-1",
        appVersion: "0.1.0",
        createdAt: "2027-01-01T00:00:00Z",
        // @ts-expect-error -- deliberately omitted to prove it's required
        keyEnvelope: undefined,
      }),
    ).toThrow();
  });
});
