// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { MatterSchema } from "./matter.ts";

const baseMatter = {
  id: "m1",
  taxpayerId: "t1",
  matterType: "Field audit",
  status: "open" as const,
  openedDate: "2027-01-01",
};

describe("MatterSchema", () => {
  it("accepts a non-Tax-Court matter without taxCourtDetails", () => {
    const result = MatterSchema.parse({ ...baseMatter, category: "examination" });
    expect(result.category).toBe("examination");
    expect(result.taxCourtDetails).toBeUndefined();
  });

  it("rejects a Tax Court matter with no taxCourtDetails", () => {
    expect(() => MatterSchema.parse({ ...baseMatter, category: "tax-court" })).toThrow(
      /taxCourtDetails/,
    );
  });

  it("accepts a Tax Court matter with taxCourtDetails", () => {
    const result = MatterSchema.parse({
      ...baseMatter,
      category: "tax-court",
      taxCourtDetails: {
        docketNumber: "12345-27",
        petitionDate: "2027-03-01",
      },
    });
    expect(result.taxCourtDetails?.docketNumber).toBe("12345-27");
    expect(result.taxCourtDetails?.court).toBe("United States Tax Court");
  });

  it("rejects an unknown category", () => {
    expect(() =>
      MatterSchema.parse({ ...baseMatter, category: "bankruptcy" }),
    ).toThrow();
  });
});
