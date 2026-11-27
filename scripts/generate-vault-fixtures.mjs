#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Dev tool, never imported by product code. Prints fixed-input vectors for
// the iOS Swift port's test suite to hardcode, proving its independent
// implementation produces byte-identical output against this real one --
// not just "round-trips with itself." Covers every primitive the port
// needs: passphrase and recovery-code key-encryption keys, master-key
// wrapping, and the AES-GCM data envelope used to decrypt a vault
// snapshot. See advocatra-ios's AdvocatraVault module and
// docs/architecture/TECHNICAL-DESIGN.md §5/§9.
//
// Run: node scripts/generate-vault-fixtures.mjs
import { bytesToBase64, utf8ToBytes } from "../packages/crypto/src/bytes.ts";
import { deriveDataKey } from "../packages/crypto/src/derive.ts";
import { deriveKeyEncryptionKey } from "../packages/crypto/src/passphrase-kdf.ts";
import { deriveKeyEncryptionKeyFromRecoveryCode } from "../packages/crypto/src/recovery.ts";

const PASSPHRASE = "correct horse battery staple";
const SALT = new Uint8Array(Array.from({ length: 16 }, (_, i) => i));
const ITERATIONS = 1000; // fixture-only; production uses DEFAULT_PBKDF2_ITERATIONS
const RECOVERY_CODE = "C04KV-31VF8-0K0JW-R7NPT-007DW";
const MASTER_KEY_MATERIAL = new Uint8Array(
  Array.from({ length: 32 }, (_, i) => i + 100),
);
const WRAP_IV = new Uint8Array(Array.from({ length: 12 }, (_, i) => i + 200));
const DATA_IV = new Uint8Array(Array.from({ length: 12 }, (_, i) => i + 10));
const PLAINTEXT = utf8ToBytes('{"taxpayers":[],"matters":[],"documents":[]}');
const AAD = { vaultId: "vault-1", purpose: "records", schemaVersion: 1 };

async function wrapWithFixedIv(material, kek, iv) {
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    kek,
    material,
  );
  const wrapped = new Uint8Array(iv.length + ciphertext.byteLength);
  wrapped.set(iv, 0);
  wrapped.set(new Uint8Array(ciphertext), iv.length);
  return wrapped;
}

function canonicalAad(aad) {
  return utf8ToBytes(
    JSON.stringify({
      vaultId: aad.vaultId,
      purpose: aad.purpose,
      schemaVersion: aad.schemaVersion,
    }),
  );
}

async function main() {
  const passphraseKek = await deriveKeyEncryptionKey(PASSPHRASE, SALT, ITERATIONS);
  const wrappedByPassphrase = await wrapWithFixedIv(
    MASTER_KEY_MATERIAL,
    passphraseKek,
    WRAP_IV,
  );

  const recoveryKek = await deriveKeyEncryptionKeyFromRecoveryCode(RECOVERY_CODE);
  const wrappedByRecovery = await wrapWithFixedIv(
    MASTER_KEY_MATERIAL,
    recoveryKek,
    WRAP_IV,
  );

  const recordsKey = await deriveDataKey(MASTER_KEY_MATERIAL, "records");
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: DATA_IV, additionalData: canonicalAad(AAD) },
    recordsKey,
    PLAINTEXT,
  );

  console.log(
    JSON.stringify(
      {
        passphraseKek: {
          passphrase: PASSPHRASE,
          saltBase64: bytesToBase64(SALT),
          iterations: ITERATIONS,
          masterKeyMaterialBase64: bytesToBase64(MASTER_KEY_MATERIAL),
          wrapIvBase64: bytesToBase64(WRAP_IV),
          wrappedMasterKeyBase64: bytesToBase64(wrappedByPassphrase),
        },
        recoveryKek: {
          recoveryCode: RECOVERY_CODE,
          masterKeyMaterialBase64: bytesToBase64(MASTER_KEY_MATERIAL),
          wrapIvBase64: bytesToBase64(WRAP_IV),
          wrappedMasterKeyBase64: bytesToBase64(wrappedByRecovery),
        },
        recordsDataEnvelope: {
          masterKeyMaterialBase64: bytesToBase64(MASTER_KEY_MATERIAL),
          aad: AAD,
          plaintextUtf8: new TextDecoder().decode(PLAINTEXT),
          ivBase64: bytesToBase64(DATA_IV),
          ciphertextBase64: bytesToBase64(new Uint8Array(sealed)),
        },
      },
      null,
      2,
    ),
  );
}

main();
