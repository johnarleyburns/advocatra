// SPDX-License-Identifier: AGPL-3.0-only
import type { KeyValueStore } from "./ports.ts";

/** In-memory stand-in for the Cloudflare KV binding used for host→tenant lookup. */
export class FakeKv implements KeyValueStore {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  /** Test-only inspection helper; not part of the KeyValueStore port. */
  has(key: string): boolean {
    return this.store.has(key);
  }
}
