// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const TaxpayerTypeSchema = z.enum(["individual", "business"]);
export type TaxpayerType = z.infer<typeof TaxpayerTypeSchema>;

export const RepresentationAuthorizationSchema = z.object({
  onFile: z.boolean(),
  form: z.literal("2848").optional(),
  signedDate: z.iso.date().optional(),
});
export type RepresentationAuthorization = z.infer<
  typeof RepresentationAuthorizationSchema
>;

export const TaxpayerSchema = z.object({
  id: z.string(),
  type: TaxpayerTypeSchema,
  name: z.string().min(1),
  /** SSN or EIN. Part of the encrypted record; never surfaced in an index, log or manifest. */
  taxpayerIdNumber: z.string().min(1).optional(),
  address: z.string().optional(),
  phones: z.array(z.string()).default([]),
  emails: z.array(z.string()).default([]),
  representationAuthorization: RepresentationAuthorizationSchema.optional(),
  notes: z.string().optional(),
});
export type Taxpayer = z.infer<typeof TaxpayerSchema>;
