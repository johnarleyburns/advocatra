// SPDX-License-Identifier: AGPL-3.0-only
import type { Clock } from "./ports.ts";

/** A manually-advanced clock. Tests never read real wall time. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(initial: Date = new Date("2027-01-01T00:00:00Z")) {
    this.current = initial;
  }

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
