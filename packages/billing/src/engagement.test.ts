// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { EngagementSchema } from "./engagement.ts";

const base = {
  id: "e1",
  taxpayerId: "t1",
  description: "2027 1040, W-2 income only",
  status: "accepted" as const,
  createdAt: "2027-01-10T00:00:00Z",
};

describe("EngagementSchema", () => {
  it("accepts a flat-fee engagement with a committed amount", () => {
    const result = EngagementSchema.parse({
      ...base,
      pricingType: "flat",
      committedAmountCents: 8000,
      quotedFromFeeScheduleId: "fs1",
      quotedFromLineItemId: "1040-W2",
    });
    expect(result.committedAmountCents).toBe(8000);
  });

  it("rejects a flat-fee engagement with no committed amount", () => {
    expect(() => EngagementSchema.parse({ ...base, pricingType: "flat" })).toThrow(
      /committedAmountCents/,
    );
  });

  it("accepts an hourly engagement with a rate", () => {
    const result = EngagementSchema.parse({
      ...base,
      pricingType: "hourly",
      hourlyRateCentsPerHour: 25000,
    });
    expect(result.hourlyRateCentsPerHour).toBe(25000);
  });

  it("rejects an hourly engagement with no rate", () => {
    expect(() => EngagementSchema.parse({ ...base, pricingType: "hourly" })).toThrow(
      /hourlyRateCentsPerHour/,
    );
  });

  it("accepts a retainer engagement with neither a flat amount nor an hourly rate", () => {
    const result = EngagementSchema.parse({ ...base, pricingType: "retainer" });
    expect(result.pricingType).toBe("retainer");
  });
});
