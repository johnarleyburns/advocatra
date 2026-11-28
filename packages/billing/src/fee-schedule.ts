// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const MINIMUM_GUARANTEE_DAYS = 30;

export const LineItemPricingTypeSchema = z.enum(["flat", "hourly"]);
export type LineItemPricingType = z.infer<typeof LineItemPricingTypeSchema>;

export const FeeScheduleLineItemSchema = z.object({
  /** Stable within this schedule; what Engagement.quotedFromLineItemId points at. */
  id: z.string().min(1),
  serviceCode: z.string().min(1),
  label: z.string().min(1),
  pricingType: LineItemPricingTypeSchema,
  /** Integer cents. Never a floating-point number for money. */
  amountCents: z.int().nonnegative(),
});
export type FeeScheduleLineItem = z.infer<typeof FeeScheduleLineItemSchema>;

export const FeeScheduleSchema = z
  .object({
    id: z.string(),
    title: z.string().min(1),
    effectiveDate: z.iso.date(),
    publishedAt: z.iso.datetime(),
    /**
     * Minimum days this schedule must be honored once published, per the
     * practitioner's professional-conduct fee-schedule rule (see
     * TECHNICAL-DESIGN.md §6/§9 for the citation caveat). Defaults to 30.
     */
    guaranteeDays: z.int().nonnegative().default(MINIMUM_GUARANTEE_DAYS),
    /**
     * Required, and persisted as the audit trail, whenever guaranteeDays is
     * set below MINIMUM_GUARANTEE_DAYS. Enforced by this schema's own
     * .refine() below (not just by createFeeSchedule), so a direct
     * FeeScheduleSchema.parse() call anywhere else in the codebase can't
     * bypass the guarantee.
     */
    guaranteeDaysOverrideReason: z.string().min(1).optional(),
    supersedesId: z.string().optional(),
    lineItems: z.array(FeeScheduleLineItemSchema).min(1),
  })
  .refine(
    (schedule) =>
      schedule.guaranteeDays >= MINIMUM_GUARANTEE_DAYS ||
      schedule.guaranteeDaysOverrideReason !== undefined,
    {
      message: `guaranteeDays below ${MINIMUM_GUARANTEE_DAYS} requires an explicit, recorded guaranteeDaysOverrideReason`,
      path: ["guaranteeDays"],
    },
  );
export type FeeSchedule = z.infer<typeof FeeScheduleSchema>;

/**
 * Create a validated FeeSchedule. `options.overrideReason` is folded into
 * `guaranteeDaysOverrideReason` before validation; the schema itself (see
 * above) is what actually refuses a `guaranteeDays` below
 * MINIMUM_GUARANTEE_DAYS without one.
 */
export function createFeeSchedule(
  input: z.input<typeof FeeScheduleSchema>,
  options?: { overrideReason?: string },
): FeeSchedule {
  return FeeScheduleSchema.parse({
    ...input,
    ...(options?.overrideReason
      ? { guaranteeDaysOverrideReason: options.overrideReason }
      : {}),
  });
}

/** The date this schedule must be honored through. */
export function feeScheduleHonorUntil(schedule: FeeSchedule): Date {
  const published = new Date(schedule.publishedAt);
  return new Date(published.getTime() + schedule.guaranteeDays * 24 * 60 * 60 * 1000);
}

/** Whether this schedule may be superseded by a new one at time `now`. */
export function canSupersedeFeeSchedule(schedule: FeeSchedule, now: Date): boolean {
  return now.getTime() >= feeScheduleHonorUntil(schedule).getTime();
}
