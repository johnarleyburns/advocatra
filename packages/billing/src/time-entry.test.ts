// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { TimeEntrySchema, timeEntryAmountCents } from "./time-entry.ts";

describe("timeEntryAmountCents", () => {
  it("bills a fractional hour at the snapshotted rate", () => {
    const entry = TimeEntrySchema.parse({
      id: "te1",
      engagementId: "e1",
      date: "2027-03-01",
      durationHours: 0.25,
      description: "Reviewed CP2000 notice",
      rateAtEntryCentsPerHour: 25000,
    });
    expect(timeEntryAmountCents(entry)).toBe(6250);
  });

  it("is zero for a non-billable entry", () => {
    const entry = TimeEntrySchema.parse({
      id: "te1",
      engagementId: "e1",
      date: "2027-03-01",
      durationHours: 1,
      description: "Internal admin",
      billable: false,
      rateAtEntryCentsPerHour: 25000,
    });
    expect(timeEntryAmountCents(entry)).toBe(0);
  });

  it("defaults billable to true", () => {
    const entry = TimeEntrySchema.parse({
      id: "te1",
      engagementId: "e1",
      date: "2027-03-01",
      durationHours: 1,
      description: "Client call",
      rateAtEntryCentsPerHour: 25000,
    });
    expect(entry.billable).toBe(true);
  });
});
