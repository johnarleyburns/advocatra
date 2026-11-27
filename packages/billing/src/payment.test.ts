// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { InvoiceSchema } from "./invoice.ts";
import {
  invoiceAmountOutstandingCents,
  invoiceAmountPaidCents,
  PaymentSchema,
} from "./payment.ts";

const invoice = InvoiceSchema.parse({
  id: "inv1",
  taxpayerId: "t1",
  engagementIds: ["e1"],
  invoiceNumber: 1,
  issueDate: "2027-03-01",
  dueDate: "2027-03-31",
  status: "sent",
  lineItems: [
    {
      description: "2027 1040 flat fee",
      quantity: 1,
      rateCents: 8000,
      amountCents: 8000,
    },
  ],
});

describe("invoice payments", () => {
  it("supports a partial payment, leaving an outstanding balance", () => {
    const payments = [
      PaymentSchema.parse({
        id: "p1",
        invoiceId: "inv1",
        date: "2027-03-05",
        amountCents: 3000,
        method: "card",
      }),
    ];
    expect(invoiceAmountPaidCents(invoice, payments)).toBe(3000);
    expect(invoiceAmountOutstandingCents(invoice, payments)).toBe(5000);
  });

  it("ignores payments for other invoices", () => {
    const payments = [
      PaymentSchema.parse({
        id: "p1",
        invoiceId: "other-invoice",
        date: "2027-03-05",
        amountCents: 3000,
        method: "card",
      }),
    ];
    expect(invoiceAmountPaidCents(invoice, payments)).toBe(0);
    expect(invoiceAmountOutstandingCents(invoice, payments)).toBe(8000);
  });

  it("floors outstanding at zero when overpaid", () => {
    const payments = [
      PaymentSchema.parse({
        id: "p1",
        invoiceId: "inv1",
        date: "2027-03-05",
        amountCents: 9000,
        method: "card",
      }),
    ];
    expect(invoiceAmountOutstandingCents(invoice, payments)).toBe(0);
  });
});
