// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const CorrespondenceDirectionSchema = z.enum(["inbound", "outbound"]);
export type CorrespondenceDirection = z.infer<typeof CorrespondenceDirectionSchema>;

export const CorrespondenceMethodSchema = z.enum([
  "mail",
  "fax",
  "efax",
  "portal",
  "phone",
  "email",
]);
export type CorrespondenceMethod = z.infer<typeof CorrespondenceMethodSchema>;

export const CorrespondenceSchema = z.object({
  id: z.string(),
  matterId: z.string(),
  direction: CorrespondenceDirectionSchema,
  method: CorrespondenceMethodSchema,
  date: z.iso.date(),
  summary: z.string().min(1),
  relatedDocumentIds: z.array(z.string()).default([]),
});
export type Correspondence = z.infer<typeof CorrespondenceSchema>;
