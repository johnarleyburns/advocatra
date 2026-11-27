// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const DocumentTypeSchema = z.enum([
  "notice",
  "correspondence",
  "pleading",
  "discovery",
  "order",
  "financial",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const CaseDocumentSchema = z.object({
  id: z.string(),
  taxpayerId: z.string(),
  matterId: z.string(),
  type: DocumentTypeSchema,
  taxYear: z.int().optional(),
  description: z.string(),
  /**
   * Reference to the encrypted object (storage layer concern), never the
   * plaintext bytes or a cleartext filename with taxpayer identifiers.
   */
  encryptedObjectRef: z.string(),
  uploadedAt: z.iso.datetime(),
});
export type CaseDocument = z.infer<typeof CaseDocumentSchema>;
