// SPDX-License-Identifier: AGPL-3.0-only
import type { IdGenerator } from "./ports.ts";

/** Deterministic, sequential ids — never `Math.random()` or `crypto.randomUUID()` in tests. */
export class FakeIdGenerator implements IdGenerator {
  private counter = 0;

  newId(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}
