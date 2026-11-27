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

/**
 * Shaped after Cloudflare's real R2Bucket binding (put/get only — this app
 * never needs list/delete/multipart). Stores and serves opaque text
 * (always an `EncryptedEnvelope` JSON string in practice) — this port has
 * no concept of what the ciphertext means and must never be given a
 * decrypt function to call.
 */
export interface ObjectStore {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
}
