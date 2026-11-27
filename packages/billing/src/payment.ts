// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import type { Invoice } from "./invoice.ts";
import { invoiceSubtotalCents } from "./invoice.ts";

export const PaymentMethodSchema = z.enum([
  "check",
  "ach",
  "card",
  "cash",
  "retainer-draw",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  date: z.iso.date(),
  amountCents: z.int().positive(),
  method: PaymentMethodSchema,
  reference: z.string().optional(),
});
export type Payment = z.infer<typeof PaymentSchema>;

/** Total paid toward one invoice, in integer cents. Supports partial payments. */
export function invoiceAmountPaidCents(
  invoice: Invoice,
  payments: readonly Payment[],
): number {
  return payments
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((sum, p) => sum + p.amountCents, 0);
}

/** Remaining balance on an invoice, in integer cents, floored at zero. */
export function invoiceAmountOutstandingCents(
  invoice: Invoice,
  payments: readonly Payment[],
): number {
  const outstanding =
    invoiceSubtotalCents(invoice) - invoiceAmountPaidCents(invoice, payments);
  return Math.max(outstanding, 0);
}
