// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const InvoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const InvoiceLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  rateCents: z.int().nonnegative(),
  amountCents: z.int().nonnegative(),
  sourceTimeEntryIds: z.array(z.string()).default([]),
  engagementId: z.string().optional(),
});
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

export const InvoiceSchema = z.object({
  id: z.string(),
  taxpayerId: z.string(),
  engagementIds: z.array(z.string()).min(1),
  invoiceNumber: z.int().positive(),
  issueDate: z.iso.date(),
  dueDate: z.iso.date(),
  lineItems: z.array(InvoiceLineItemSchema).min(1),
  status: InvoiceStatusSchema,
});
export type Invoice = z.infer<typeof InvoiceSchema>;

/** Sum of an invoice's line items, in integer cents. */
export function invoiceSubtotalCents(invoice: Invoice): number {
  return invoice.lineItems.reduce((sum, item) => sum + item.amountCents, 0);
}
