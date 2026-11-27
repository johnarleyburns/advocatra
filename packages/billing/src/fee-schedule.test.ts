// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  canSupersedeFeeSchedule,
  createFeeSchedule,
  feeScheduleHonorUntil,
  MINIMUM_GUARANTEE_DAYS,
} from "./fee-schedule.ts";

const published = "2027-01-01T00:00:00Z";
const lineItems = [
  {
    serviceCode: "1040-W2",
    label: "1040, W-2 income only",
    pricingType: "flat" as const,
    amountCents: 8000,
  },
  {
    serviceCode: "1040-SCHC-INVEST",
    label: "1040, business + investment income",
    pricingType: "flat" as const,
    amountCents: 50000,
  },
];

describe("createFeeSchedule", () => {
  it("defaults guaranteeDays to the minimum", () => {
    const schedule = createFeeSchedule({
      id: "fs1",
      title: "2027 Standard Fee Schedule",
      effectiveDate: "2027-01-01",
      publishedAt: published,
      lineItems,
    });
    expect(schedule.guaranteeDays).toBe(MINIMUM_GUARANTEE_DAYS);
  });

  it("refuses a guarantee shorter than the minimum without an override reason", () => {
    expect(() =>
      createFeeSchedule({
        id: "fs1",
        title: "2027 Standard Fee Schedule",
        effectiveDate: "2027-01-01",
        publishedAt: published,
        guaranteeDays: 7,
        lineItems,
      }),
    ).toThrow(/overrideReason/);
  });

  it("allows a shorter guarantee with an explicit override reason", () => {
    const schedule = createFeeSchedule(
      {
        id: "fs1",
        title: "2027 Standard Fee Schedule",
        effectiveDate: "2027-01-01",
        publishedAt: published,
        guaranteeDays: 7,
        lineItems,
      },
      { overrideReason: "counsel-approved exception, see matter #123" },
    );
    expect(schedule.guaranteeDays).toBe(7);
  });
});

describe("canSupersedeFeeSchedule", () => {
  it("is false before the guarantee window elapses", () => {
    const schedule = createFeeSchedule({
      id: "fs1",
      title: "2027 Standard Fee Schedule",
      effectiveDate: "2027-01-01",
      publishedAt: published,
      lineItems,
    });
    expect(canSupersedeFeeSchedule(schedule, new Date("2027-01-15"))).toBe(false);
  });

  it("is true once the guarantee window has elapsed", () => {
    const schedule = createFeeSchedule({
      id: "fs1",
      title: "2027 Standard Fee Schedule",
      effectiveDate: "2027-01-01",
      publishedAt: published,
      lineItems,
    });
    const honorUntil = feeScheduleHonorUntil(schedule);
    expect(canSupersedeFeeSchedule(schedule, honorUntil)).toBe(true);
    expect(canSupersedeFeeSchedule(schedule, new Date("2026-01-01"))).toBe(false);
  });
});
