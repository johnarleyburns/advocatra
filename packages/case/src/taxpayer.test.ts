// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { TaxpayerSchema } from "./taxpayer.ts";

describe("TaxpayerSchema", () => {
  it("accepts a minimal individual taxpayer", () => {
    const result = TaxpayerSchema.parse({
      id: "t1",
      type: "individual",
      name: "Jane Doe",
    });
    expect(result.phones).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it("accepts representation authorization on file", () => {
    const result = TaxpayerSchema.parse({
      id: "t1",
      type: "individual",
      name: "Jane Doe",
      representationAuthorization: {
        onFile: true,
        form: "2848",
        signedDate: "2027-01-15",
      },
    });
    expect(result.representationAuthorization?.onFile).toBe(true);
  });

  it("rejects a taxpayer with no name", () => {
    expect(() =>
      TaxpayerSchema.parse({ id: "t1", type: "individual", name: "" }),
    ).toThrow();
  });

  it("rejects an unknown taxpayer type", () => {
    expect(() =>
      TaxpayerSchema.parse({ id: "t1", type: "trust", name: "Jane Doe" }),
    ).toThrow();
  });
});
