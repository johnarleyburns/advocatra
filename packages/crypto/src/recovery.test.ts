// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  deriveKeyEncryptionKeyFromRecoveryCode,
  generateRecoveryCode,
} from "./recovery.ts";
import {
  generateVaultMasterKeyMaterial,
  unwrapVaultMasterKeyMaterial,
  wrapVaultMasterKeyMaterial,
} from "./vault-key.ts";

describe("generateRecoveryCode", () => {
  it("produces 5 groups of 5 Crockford-base32 characters, hyphen-separated", () => {
    const code = generateRecoveryCode();
    const groups = code.split("-");
    expect(groups).toHaveLength(5);
    for (const group of groups) {
      expect(group).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}$/);
    }
  });

  it("never contains the excluded look-alike letters I, L, O, U", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRecoveryCode()).not.toMatch(/[ILOU]/);
    }
  });

  it("is not deterministic across calls", () => {
    expect(generateRecoveryCode()).not.toBe(generateRecoveryCode());
  });
});

describe("deriveKeyEncryptionKeyFromRecoveryCode", () => {
  it("derives a key usable to wrap and unwrap the vault master key", async () => {
    const code = generateRecoveryCode();
    const kek = await deriveKeyEncryptionKeyFromRecoveryCode(code);
    const material = generateVaultMasterKeyMaterial();
    const wrapped = await wrapVaultMasterKeyMaterial(material, kek);
    expect(await unwrapVaultMasterKeyMaterial(wrapped, kek)).toEqual(material);
  });

  it("is case- and whitespace-insensitive, matching how a user re-types it", async () => {
    const code = generateRecoveryCode();
    const kekA = await deriveKeyEncryptionKeyFromRecoveryCode(code);
    const kekB = await deriveKeyEncryptionKeyFromRecoveryCode(
      `  ${code.toLowerCase()}  `,
    );
    const material = generateVaultMasterKeyMaterial();
    const wrapped = await wrapVaultMasterKeyMaterial(material, kekA);
    expect(await unwrapVaultMasterKeyMaterial(wrapped, kekB)).toEqual(material);
  });

  it("a different recovery code cannot unwrap the vault master key", async () => {
    const kek = await deriveKeyEncryptionKeyFromRecoveryCode(generateRecoveryCode());
    const wrongKek = await deriveKeyEncryptionKeyFromRecoveryCode(
      generateRecoveryCode(),
    );
    const material = generateVaultMasterKeyMaterial();
    const wrapped = await wrapVaultMasterKeyMaterial(material, kek);
    await expect(unwrapVaultMasterKeyMaterial(wrapped, wrongKek)).rejects.toThrow();
  });
});
