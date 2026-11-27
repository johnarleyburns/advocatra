// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { isTaskOverdue, TaskSchema } from "./task.ts";

describe("isTaskOverdue", () => {
  it("is false for a task with no due date", () => {
    const task = TaskSchema.parse({
      id: "k1",
      matterId: "m1",
      title: "Call client",
      status: "open",
    });
    expect(isTaskOverdue(task, new Date("2027-06-01"))).toBe(false);
  });

  it("is false for a done task even if the due date passed", () => {
    const task = TaskSchema.parse({
      id: "k1",
      matterId: "m1",
      title: "Call client",
      status: "done",
      dueDate: "2027-01-01",
    });
    expect(isTaskOverdue(task, new Date("2027-06-01"))).toBe(false);
  });

  it("is true for an open task past its due date", () => {
    const task = TaskSchema.parse({
      id: "k1",
      matterId: "m1",
      title: "Call client",
      status: "open",
      dueDate: "2027-01-01",
    });
    expect(isTaskOverdue(task, new Date("2027-06-01"))).toBe(true);
  });

  it("is false for an open task before its due date", () => {
    const task = TaskSchema.parse({
      id: "k1",
      matterId: "m1",
      title: "Call client",
      status: "open",
      dueDate: "2027-12-01",
    });
    expect(isTaskOverdue(task, new Date("2027-06-01"))).toBe(false);
  });
});
