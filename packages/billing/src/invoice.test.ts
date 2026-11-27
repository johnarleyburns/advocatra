// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { InvoiceSchema, invoiceSubtotalCents } from "./invoice.ts";

describe("invoiceSubtotalCents", () => {
  it("sums the line items' amounts", () => {
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
        {
          description: "0.25 hr consult",
          quantity: 0.25,
          rateCents: 25000,
          amountCents: 6250,
        },
      ],
    });
    expect(invoiceSubtotalCents(invoice)).toBe(14250);
  });
});
