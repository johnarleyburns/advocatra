// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { CaseDocumentSchema } from "./document.ts";

describe("CaseDocumentSchema", () => {
  it("accepts a document referencing an encrypted object", () => {
    const result = CaseDocumentSchema.parse({
      id: "d1",
      taxpayerId: "t1",
      matterId: "m1",
      type: "notice",
      description: "CP2000 notice, tax year 2026",
      encryptedObjectRef: "sha256:abc123",
      uploadedAt: "2027-02-01T12:00:00Z",
    });
    expect(result.encryptedObjectRef).toBe("sha256:abc123");
  });

  it("rejects an unknown document type", () => {
    expect(() =>
      CaseDocumentSchema.parse({
        id: "d1",
        taxpayerId: "t1",
        matterId: "m1",
        type: "meme",
        description: "n/a",
        encryptedObjectRef: "sha256:abc123",
        uploadedAt: "2027-02-01T12:00:00Z",
      }),
    ).toThrow();
  });
});
