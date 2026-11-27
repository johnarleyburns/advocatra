// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const TaskStatusSchema = z.enum(["open", "done"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  matterId: z.string(),
  title: z.string().min(1),
  dueDate: z.iso.date().optional(),
  status: TaskStatusSchema,
  assignedTo: z.string().optional(),
  reminderDate: z.iso.date().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

/** A task is overdue if it's still open and its due date has passed `now`. */
export function isTaskOverdue(task: Task, now: Date): boolean {
  if (task.status !== "open" || task.dueDate === undefined) return false;
  return new Date(task.dueDate).getTime() < now.getTime();
}
