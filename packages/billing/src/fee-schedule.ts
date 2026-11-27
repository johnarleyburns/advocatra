// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const MINIMUM_GUARANTEE_DAYS = 30;

export const LineItemPricingTypeSchema = z.enum(["flat", "hourly"]);
export type LineItemPricingType = z.infer<typeof LineItemPricingTypeSchema>;

export const FeeScheduleLineItemSchema = z.object({
  serviceCode: z.string().min(1),
  label: z.string().min(1),
  pricingType: LineItemPricingTypeSchema,
  /** Integer cents. Never a floating-point number for money. */
  amountCents: z.int().nonnegative(),
});
export type FeeScheduleLineItem = z.infer<typeof FeeScheduleLineItemSchema>;

export const FeeScheduleSchema = z.object({
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
  supersedesId: z.string().optional(),
  lineItems: z.array(FeeScheduleLineItemSchema).min(1),
});
export type FeeSchedule = z.infer<typeof FeeScheduleSchema>;

/**
 * Create a validated FeeSchedule. Refuses a `guaranteeDays` below
 * MINIMUM_GUARANTEE_DAYS unless the caller supplies an explicit
 * `overrideReason`, which the caller is responsible for persisting
 * alongside the schedule as part of the audit trail.
 */
export function createFeeSchedule(
  input: z.input<typeof FeeScheduleSchema>,
  options?: { overrideReason?: string },
): FeeSchedule {
  const schedule = FeeScheduleSchema.parse(input);
  if (schedule.guaranteeDays < MINIMUM_GUARANTEE_DAYS && !options?.overrideReason) {
    throw new Error(
      `guaranteeDays below ${MINIMUM_GUARANTEE_DAYS} requires an explicit, recorded overrideReason`,
    );
  }
  return schedule;
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
