// SPDX-License-Identifier: AGPL-3.0-only
//
// Create and unlock a vault via passphrase or recovery code. Ported from
// Saldima's shipped `setUpVault`/`unwrapVaultDek` design (see
// `apps/web/src/client/vault.ts` there) — same two-independent-KEKs
// mechanism, adapted to this package's manifest/master-key shapes.

import {
  base64ToBytes,
  bytesToBase64,
  DEFAULT_PBKDF2_ITERATIONS,
  deriveKeyEncryptionKey,
  deriveKeyEncryptionKeyFromRecoveryCode,
  generateRecoveryCode,
  generateVaultMasterKeyMaterial,
  randomBytes,
  unwrapVaultMasterKeyMaterial,
  wrapVaultMasterKeyMaterial,
} from "@advocatra/crypto";
import {
  createVaultManifest,
  type KeyEnvelope,
  type VaultManifest,
} from "./manifest.ts";

const PASSPHRASE_SALT_LENGTH = 16;

export class VaultUnlockError extends Error {}

export interface CreateVaultInput {
  readonly vaultId: string;
  readonly appVersion: string;
  readonly createdAt: string;
  readonly passphrase: string;
}

export interface CreateVaultResult {
  readonly manifest: VaultManifest;
  readonly masterKeyMaterial: Uint8Array;
  /**
   * Shown to the user exactly once, here. Never stored, never uploaded —
   * losing both this and the passphrase makes the vault permanently
   * unrecoverable. The caller is responsible for displaying/printing it.
   */
  readonly recoveryCode: string;
}

/** Create a brand-new vault: a random master key, wrapped under both a passphrase and a recovery code. */
export async function createVault(input: CreateVaultInput): Promise<CreateVaultResult> {
  const masterKeyMaterial = generateVaultMasterKeyMaterial();

  const salt = randomBytes(PASSPHRASE_SALT_LENGTH);
  const passphraseKek = await deriveKeyEncryptionKey(
    input.passphrase,
    salt,
    DEFAULT_PBKDF2_ITERATIONS,
  );
  const wrappedByPassphrase = await wrapVaultMasterKeyMaterial(
    masterKeyMaterial,
    passphraseKek,
  );

  const recoveryCode = generateRecoveryCode();
  const recoveryKek = await deriveKeyEncryptionKeyFromRecoveryCode(recoveryCode);
  const wrappedByRecovery = await wrapVaultMasterKeyMaterial(
    masterKeyMaterial,
    recoveryKek,
  );

  const keyEnvelope: KeyEnvelope = {
    version: 1,
    passphrase: {
      kdf: "PBKDF2-SHA256",
      iterations: DEFAULT_PBKDF2_ITERATIONS,
      saltBase64: bytesToBase64(salt),
      wrappedMasterKeyBase64: bytesToBase64(wrappedByPassphrase),
    },
    recovery: { wrappedMasterKeyBase64: bytesToBase64(wrappedByRecovery) },
  };

  const manifest = createVaultManifest({
    vaultId: input.vaultId,
    appVersion: input.appVersion,
    createdAt: input.createdAt,
    keyEnvelope,
  });

  return { manifest, masterKeyMaterial, recoveryCode };
}

async function unwrapWithKek(
  wrappedBase64: string,
  kek: CryptoKey,
): Promise<Uint8Array> {
  try {
    return await unwrapVaultMasterKeyMaterial(base64ToBytes(wrappedBase64), kek);
  } catch {
    throw new VaultUnlockError("incorrect passphrase or recovery code");
  }
}

/** Unlock a vault with its passphrase, returning the vault master key material. */
export async function unlockVaultWithPassphrase(
  manifest: VaultManifest,
  passphrase: string,
): Promise<Uint8Array> {
  const { passphrase: p } = manifest.keyEnvelope;
  const kek = await deriveKeyEncryptionKey(
    passphrase,
    base64ToBytes(p.saltBase64),
    p.iterations,
  );
  return unwrapWithKek(p.wrappedMasterKeyBase64, kek);
}

/** Unlock a vault with its recovery code, returning the vault master key material. */
export async function unlockVaultWithRecoveryCode(
  manifest: VaultManifest,
  recoveryCode: string,
): Promise<Uint8Array> {
  const kek = await deriveKeyEncryptionKeyFromRecoveryCode(recoveryCode);
  return unwrapWithKek(manifest.keyEnvelope.recovery.wrappedMasterKeyBase64, kek);
}
