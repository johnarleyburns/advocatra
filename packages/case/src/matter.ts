// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const MatterCategorySchema = z.enum([
  "examination",
  "collection",
  "cdp",
  "appeals",
  "penalties",
  "innocent-spouse",
  "employment-tax",
  "information-reporting",
  "tax-court",
  "other",
]);
export type MatterCategory = z.infer<typeof MatterCategorySchema>;

export const MatterStatusSchema = z.enum(["open", "pending", "closed"]);
export type MatterStatus = z.infer<typeof MatterStatusSchema>;

/**
 * Tax Court is a first-class matter type (not a future add-on). These fields
 * are required whenever Matter.category === "tax-court" — see the refinement
 * on MatterSchema below.
 */
export const TaxCourtDetailsSchema = z.object({
  court: z.string().default("United States Tax Court"),
  docketNumber: z.string().optional(),
  petitionDate: z.iso.date().optional(),
  noticeOfDeficiencyDate: z.iso.date().optional(),
  petitionDeadline: z.iso.date().optional(),
  answerDate: z.iso.date().optional(),
  assignedIrsCounsel: z.string().optional(),
  discoveryStatus: z.string().optional(),
  motions: z.array(z.string()).default([]),
  trialSession: z.string().optional(),
  settlementStatus: z.string().optional(),
  decision: z.string().optional(),
  appealInfo: z.string().optional(),
});
export type TaxCourtDetails = z.infer<typeof TaxCourtDetailsSchema>;

export const MatterSchema = z
  .object({
    id: z.string(),
    taxpayerId: z.string(),
    category: MatterCategorySchema,
    matterType: z.string().min(1),
    status: MatterStatusSchema,
    taxYears: z.array(z.int()).default([]),
    openedDate: z.iso.date(),
    closedDate: z.iso.date().optional(),
    assignedPractitioner: z.string().optional(),
    notes: z.string().optional(),
    taxCourtDetails: TaxCourtDetailsSchema.optional(),
  })
  .refine(
    (matter) => matter.category !== "tax-court" || matter.taxCourtDetails !== undefined,
    {
      message: 'taxCourtDetails is required when category is "tax-court"',
      path: ["taxCourtDetails"],
    },
  );
export type Matter = z.infer<typeof MatterSchema>;
