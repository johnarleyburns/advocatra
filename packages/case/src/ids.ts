// SPDX-License-Identifier: AGPL-3.0-only

/** Opaque record identifier. Generation is the storage layer's job, not this schema's. */
export type Id = string;

/**
 * Convenience generator for tests and scaffolding. The real app/storage layer
 * should inject an IdGenerator port instead, the same way Saldima does, once
 * that layer exists — this is not that port.
 */
export function createId(): Id {
  return crypto.randomUUID();
}
