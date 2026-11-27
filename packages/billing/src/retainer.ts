// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const RetainerDepositSchema = z.object({
  date: z.iso.date(),
  amountCents: z.int().positive(),
  paymentId: z.string().optional(),
});
export type RetainerDeposit = z.infer<typeof RetainerDepositSchema>;

export const RetainerDrawSchema = z.object({
  date: z.iso.date(),
  amountCents: z.int().positive(),
  invoiceId: z.string().optional(),
  description: z.string().optional(),
});
export type RetainerDraw = z.infer<typeof RetainerDrawSchema>;

export const RetainerSchema = z.object({
  id: z.string(),
  taxpayerId: z.string(),
  engagementId: z.string().optional(),
  initialAmountCents: z.int().nonnegative(),
  currentBalanceCents: z.int(),
  replenishmentThresholdCents: z.int().nonnegative().optional(),
  deposits: z.array(RetainerDepositSchema).default([]),
  draws: z.array(RetainerDrawSchema).default([]),
});
export type Retainer = z.infer<typeof RetainerSchema>;

/** Recompute the balance from history, independent of the stored `currentBalanceCents`. */
export function computeRetainerBalance(retainer: Retainer): number {
  const deposited = retainer.deposits.reduce((sum, d) => sum + d.amountCents, 0);
  const drawn = retainer.draws.reduce((sum, d) => sum + d.amountCents, 0);
  return retainer.initialAmountCents + deposited - drawn;
}

/** Whether the retainer balance is at or below its replenishment threshold. */
export function retainerNeedsReplenishment(retainer: Retainer): boolean {
  if (retainer.replenishmentThresholdCents === undefined) return false;
  return retainer.currentBalanceCents <= retainer.replenishmentThresholdCents;
}
