// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const EngagementPricingTypeSchema = z.enum(["flat", "hourly", "retainer"]);
export type EngagementPricingType = z.infer<typeof EngagementPricingTypeSchema>;

export const EngagementStatusSchema = z.enum([
  "proposed",
  "accepted",
  "active",
  "completed",
  "cancelled",
]);
export type EngagementStatus = z.infer<typeof EngagementStatusSchema>;

export const EngagementSchema = z
  .object({
    id: z.string(),
    taxpayerId: z.string(),
    matterId: z.string().optional(),
    taxYear: z.int().optional(),
    description: z.string().min(1),
    pricingType: EngagementPricingTypeSchema,
    /** Integer cents. Required when pricingType === "flat". */
    committedAmountCents: z.int().nonnegative().optional(),
    /** Integer cents per hour. Required when pricingType === "hourly". */
    hourlyRateCentsPerHour: z.int().nonnegative().optional(),
    /** Traceability: which published fee schedule / line item this was quoted from. */
    quotedFromFeeScheduleId: z.string().optional(),
    quotedFromLineItemId: z.string().optional(),
    /** Required when this engagement's price deviates from any fee-schedule line item. */
    customQuoteReason: z.string().optional(),
    status: EngagementStatusSchema,
    createdAt: z.iso.datetime(),
    acceptedAt: z.iso.datetime().optional(),
  })
  .refine((e) => e.pricingType !== "flat" || e.committedAmountCents !== undefined, {
    message: 'committedAmountCents is required when pricingType is "flat"',
    path: ["committedAmountCents"],
  })
  .refine((e) => e.pricingType !== "hourly" || e.hourlyRateCentsPerHour !== undefined, {
    message: 'hourlyRateCentsPerHour is required when pricingType is "hourly"',
    path: ["hourlyRateCentsPerHour"],
  });
export type Engagement = z.infer<typeof EngagementSchema>;
