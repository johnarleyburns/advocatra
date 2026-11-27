// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  createVault,
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryCode,
  VaultUnlockError,
} from "./vault-access.ts";

function createVaultInput(passphrase = "correct horse battery staple") {
  return {
    vaultId: "vault-1",
    appVersion: "0.1.0",
    createdAt: "2027-01-01T00:00:00Z",
    passphrase,
  };
}

describe("createVault", () => {
  it("produces a manifest whose keyEnvelope round-trips via the passphrase", async () => {
    const { manifest, masterKeyMaterial } = await createVault(createVaultInput());
    const unlocked = await unlockVaultWithPassphrase(
      manifest,
      "correct horse battery staple",
    );
    expect(unlocked).toEqual(masterKeyMaterial);
  });

  it("the same master key also unlocks via the recovery code", async () => {
    const { manifest, masterKeyMaterial, recoveryCode } = await createVault(
      createVaultInput(),
    );
    const unlocked = await unlockVaultWithRecoveryCode(manifest, recoveryCode);
    expect(unlocked).toEqual(masterKeyMaterial);
  });

  it("generates a fresh recovery code and master key on every call", async () => {
    const a = await createVault(createVaultInput());
    const b = await createVault(createVaultInput());
    expect(a.recoveryCode).not.toBe(b.recoveryCode);
    expect(a.masterKeyMaterial).not.toEqual(b.masterKeyMaterial);
  });

  it("carries the vaultId and defaults into the manifest", async () => {
    const { manifest } = await createVault(createVaultInput());
    expect(manifest.vaultId).toBe("vault-1");
    expect(manifest.keyEnvelope.passphrase.kdf).toBe("PBKDF2-SHA256");
    expect(manifest.keyEnvelope.passphrase.iterations).toBe(600_000);
  });
});

describe("unlockVaultWithPassphrase", () => {
  it("rejects the wrong passphrase", async () => {
    const { manifest } = await createVault(createVaultInput());
    await expect(
      unlockVaultWithPassphrase(manifest, "wrong passphrase entirely"),
    ).rejects.toBeInstanceOf(VaultUnlockError);
  });
});

describe("unlockVaultWithRecoveryCode", () => {
  it("rejects a different recovery code", async () => {
    const { manifest } = await createVault(createVaultInput());
    await expect(
      unlockVaultWithRecoveryCode(manifest, "0000-0000-0000-0000-0000"),
    ).rejects.toBeInstanceOf(VaultUnlockError);
  });

  it("losing the passphrase doesn't affect recovery-code unlock", async () => {
    const { manifest, recoveryCode, masterKeyMaterial } = await createVault(
      createVaultInput(),
    );
    // Simulate "forgot the passphrase": only the recovery code is used.
    const unlocked = await unlockVaultWithRecoveryCode(manifest, recoveryCode);
    expect(unlocked).toEqual(masterKeyMaterial);
  });
});
