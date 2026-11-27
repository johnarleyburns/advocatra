// SPDX-License-Identifier: AGPL-3.0-only

import {
  EngagementSchema,
  FeeScheduleSchema,
  InvoiceSchema,
  PaymentSchema,
  RetainerSchema,
  TimeEntrySchema,
} from "@advocatra/billing";
import {
  ActivityLogEntrySchema,
  CaseDocumentSchema,
  CorrespondenceSchema,
  MatterSchema,
  TaskSchema,
  TaxpayerSchema,
} from "@advocatra/case";
import { z } from "zod";

/**
 * The full decrypted contents of a vault's "records" snapshot — everything
 * except document/attachment bytes, which are encrypted and stored
 * separately (see `document-object.ts`) and only referenced by id here.
 */
export const VaultRecordsSchema = z.object({
  taxpayers: z.array(TaxpayerSchema).default([]),
  matters: z.array(MatterSchema).default([]),
  documents: z.array(CaseDocumentSchema).default([]),
  correspondence: z.array(CorrespondenceSchema).default([]),
  tasks: z.array(TaskSchema).default([]),
  activity: z.array(ActivityLogEntrySchema).default([]),
  billing: z
    .object({
      feeSchedules: z.array(FeeScheduleSchema).default([]),
      engagements: z.array(EngagementSchema).default([]),
      timeEntries: z.array(TimeEntrySchema).default([]),
      retainers: z.array(RetainerSchema).default([]),
      invoices: z.array(InvoiceSchema).default([]),
      payments: z.array(PaymentSchema).default([]),
    })
    .default(() => ({
      feeSchedules: [],
      engagements: [],
      timeEntries: [],
      retainers: [],
      invoices: [],
      payments: [],
    })),
});
export type VaultRecords = z.infer<typeof VaultRecordsSchema>;

/** An empty vault's records, for a freshly created vault. */
export function emptyVaultRecords(): VaultRecords {
  return VaultRecordsSchema.parse({});
}
