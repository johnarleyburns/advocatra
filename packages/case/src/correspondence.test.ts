// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { CorrespondenceSchema } from "./correspondence.ts";

describe("CorrespondenceSchema", () => {
  it("accepts a minimal inbound letter", () => {
    const result = CorrespondenceSchema.parse({
      id: "c1",
      matterId: "m1",
      direction: "inbound",
      method: "mail",
      date: "2027-02-01",
      summary: "CP2000 notice received",
    });
    expect(result.relatedDocumentIds).toEqual([]);
  });

  it("rejects an unknown method", () => {
    expect(() =>
      CorrespondenceSchema.parse({
        id: "c1",
        matterId: "m1",
        direction: "inbound",
        method: "carrier-pigeon",
        date: "2027-02-01",
        summary: "CP2000 notice received",
      }),
    ).toThrow();
  });
});
