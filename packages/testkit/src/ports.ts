// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Port interfaces every async/non-deterministic dependency in `apps/web`
 * enters through, mirroring Saldima's `packages/testkit` discipline: unit
 * tests use these fakes, never the real binding, never real wall time.
 */

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  newId(): string;
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
