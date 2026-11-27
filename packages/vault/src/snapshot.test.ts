// SPDX-License-Identifier: AGPL-3.0-only

import { createFeeSchedule } from "@advocatra/billing";
import {
  deriveDataKey,
  encryptBytes,
  generateVaultMasterKeyMaterial,
  utf8ToBytes,
} from "@advocatra/crypto";
import { describe, expect, it } from "vitest";
import { emptyVaultRecords, type VaultRecords } from "./records.ts";
import { decryptVaultSnapshot, encryptVaultSnapshot } from "./snapshot.ts";

function sampleRecords(): VaultRecords {
  const feeSchedule = createFeeSchedule({
    id: "fs1",
    title: "2027 Standard Fee Schedule",
    effectiveDate: "2027-01-01",
    publishedAt: "2027-01-01T00:00:00Z",
    lineItems: [
      {
        serviceCode: "1040-W2",
        label: "1040, W-2 only",
        pricingType: "flat",
        amountCents: 8000,
      },
    ],
  });

  return {
    ...emptyVaultRecords(),
    taxpayers: [
      { id: "t1", type: "individual", name: "Jane Doe", phones: [], emails: [] },
    ],
    matters: [
      {
        id: "m1",
        taxpayerId: "t1",
        category: "tax-court",
        matterType: "Deficiency",
        status: "open",
        taxYears: [2026],
        openedDate: "2027-02-01",
        taxCourtDetails: {
          court: "United States Tax Court",
          docketNumber: "12345-27",
          motions: [],
        },
      },
    ],
    billing: {
      feeSchedules: [feeSchedule],
      engagements: [],
      timeEntries: [],
      retainers: [],
      invoices: [],
      payments: [],
    },
  };
}

describe("encryptVaultSnapshot / decryptVaultSnapshot", () => {
  it("round-trips a full vault, including a Tax Court matter and a fee schedule", async () => {
    const material = generateVaultMasterKeyMaterial();
    const records = sampleRecords();
    const envelope = await encryptVaultSnapshot(records, material);
    const decrypted = await decryptVaultSnapshot(envelope, material);
    expect(decrypted).toEqual(records);
  });

  it("round-trips an empty vault", async () => {
    const material = generateVaultMasterKeyMaterial();
    const envelope = await encryptVaultSnapshot(emptyVaultRecords(), material);
    expect(await decryptVaultSnapshot(envelope, material)).toEqual(emptyVaultRecords());
  });

  it("fails with a cryptographic error under the wrong master key", async () => {
    const material = generateVaultMasterKeyMaterial();
    const wrongMaterial = generateVaultMasterKeyMaterial();
    const envelope = await encryptVaultSnapshot(sampleRecords(), material);
    await expect(decryptVaultSnapshot(envelope, wrongMaterial)).rejects.toThrow();
  });

  it("fails with a schema error when the (correctly decrypted) plaintext is malformed", async () => {
    const material = generateVaultMasterKeyMaterial();
    // Encrypt invalid content directly under the same "records" key
    // `decryptVaultSnapshot` derives, so decryption itself succeeds and the
    // failure is purely Zod's — not AES-GCM's.
    const key = await deriveDataKey(material, "records");
    const malformed = await encryptBytes(
      key,
      utf8ToBytes(JSON.stringify({ taxpayers: "not-an-array" })),
    );
    await expect(decryptVaultSnapshot(malformed, material)).rejects.toThrow(
      /taxpayers/,
    );
  });
});
