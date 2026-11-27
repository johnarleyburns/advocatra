// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { randomBytes } from "./bytes.ts";
import { deriveKeyEncryptionKey } from "./passphrase-kdf.ts";
import {
  generateVaultMasterKeyMaterial,
  unwrapVaultMasterKeyMaterial,
  wrapVaultMasterKeyMaterial,
} from "./vault-key.ts";

describe("deriveKeyEncryptionKey", () => {
  it("derives a key usable to wrap and unwrap the vault master key", async () => {
    const salt = randomBytes(16);
    const kek = await deriveKeyEncryptionKey(
      "correct horse battery staple",
      salt,
      10_000,
    );
    const material = generateVaultMasterKeyMaterial();
    const wrapped = await wrapVaultMasterKeyMaterial(material, kek);
    const unwrapped = await unwrapVaultMasterKeyMaterial(wrapped, kek);
    expect(unwrapped).toEqual(material);
  });

  it("the same passphrase and salt derive a functionally equivalent KEK", async () => {
    const salt = randomBytes(16);
    const kekA = await deriveKeyEncryptionKey(
      "correct horse battery staple",
      salt,
      10_000,
    );
    const kekB = await deriveKeyEncryptionKey(
      "correct horse battery staple",
      salt,
      10_000,
    );
    const material = generateVaultMasterKeyMaterial();
    const wrapped = await wrapVaultMasterKeyMaterial(material, kekA);
    // A key derived independently, from the same passphrase and salt, can unwrap it.
    const unwrapped = await unwrapVaultMasterKeyMaterial(wrapped, kekB);
    expect(unwrapped).toEqual(material);
  });

  it("a different passphrase derives a KEK that cannot unwrap the vault master key", async () => {
    const salt = randomBytes(16);
    const kek = await deriveKeyEncryptionKey(
      "correct horse battery staple",
      salt,
      10_000,
    );
    const wrongKek = await deriveKeyEncryptionKey("wrong passphrase", salt, 10_000);
    const material = generateVaultMasterKeyMaterial();
    const wrapped = await wrapVaultMasterKeyMaterial(material, kek);
    await expect(unwrapVaultMasterKeyMaterial(wrapped, wrongKek)).rejects.toThrow();
  });

  it("a different salt derives a KEK that cannot unwrap the vault master key", async () => {
    const kek = await deriveKeyEncryptionKey(
      "correct horse battery staple",
      randomBytes(16),
      10_000,
    );
    const wrongSaltKek = await deriveKeyEncryptionKey(
      "correct horse battery staple",
      randomBytes(16),
      10_000,
    );
    const material = generateVaultMasterKeyMaterial();
    const wrapped = await wrapVaultMasterKeyMaterial(material, kek);
    await expect(unwrapVaultMasterKeyMaterial(wrapped, wrongSaltKek)).rejects.toThrow();
  });
});
