// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  computeRetainerBalance,
  RetainerSchema,
  retainerNeedsReplenishment,
} from "./retainer.ts";

describe("computeRetainerBalance", () => {
  it("adds deposits and subtracts draws from the initial amount", () => {
    const retainer = RetainerSchema.parse({
      id: "r1",
      taxpayerId: "t1",
      initialAmountCents: 500000,
      currentBalanceCents: 350000,
      deposits: [{ date: "2027-01-01", amountCents: 100000 }],
      draws: [{ date: "2027-02-01", amountCents: 250000, description: "Feb invoice" }],
    });
    expect(computeRetainerBalance(retainer)).toBe(350000);
    expect(retainer.currentBalanceCents).toBe(computeRetainerBalance(retainer));
  });
});

describe("retainerNeedsReplenishment", () => {
  it("is false with no threshold set", () => {
    const retainer = RetainerSchema.parse({
      id: "r1",
      taxpayerId: "t1",
      initialAmountCents: 500000,
      currentBalanceCents: 1000,
    });
    expect(retainerNeedsReplenishment(retainer)).toBe(false);
  });

  it("is true once the balance falls to or below the threshold", () => {
    const retainer = RetainerSchema.parse({
      id: "r1",
      taxpayerId: "t1",
      initialAmountCents: 500000,
      currentBalanceCents: 10000,
      replenishmentThresholdCents: 50000,
    });
    expect(retainerNeedsReplenishment(retainer)).toBe(true);
  });
});
