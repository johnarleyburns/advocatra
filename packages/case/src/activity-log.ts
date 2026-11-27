// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const ActivityLogEntrySchema = z.object({
  id: z.string(),
  matterId: z.string(),
  timestamp: z.iso.datetime(),
  actor: z.string(),
  type: z.string(),
  description: z.string(),
});
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>;
