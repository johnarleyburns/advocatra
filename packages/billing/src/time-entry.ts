// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const TimeEntrySchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  date: z.iso.date(),
  /** Fractional hours (e.g. 0.25). Not a money type, so a float is fine here. */
  durationHours: z.number().positive(),
  description: z.string().min(1),
  billable: z.boolean().default(true),
  /** Integer cents per hour, snapshotted at entry time so later rate changes never reprice old work. */
  rateAtEntryCentsPerHour: z.int().nonnegative(),
  invoiceId: z.string().optional(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

/** Billable amount for one time entry, in integer cents, rounded to the nearest cent. */
export function timeEntryAmountCents(entry: TimeEntry): number {
  if (!entry.billable) return 0;
  return Math.round(entry.durationHours * entry.rateAtEntryCentsPerHour);
}
