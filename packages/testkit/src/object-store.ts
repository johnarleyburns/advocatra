// SPDX-License-Identifier: AGPL-3.0-only
import type { ObjectStore } from "./ports.ts";

/** In-memory stand-in for the Cloudflare R2 binding. */
export class FakeObjectStore implements ObjectStore {
  private readonly objects = new Map<string, string>();

  async put(key: string, value: string): Promise<void> {
    this.objects.set(key, value);
  }

  async get(key: string): Promise<{ text(): Promise<string> } | null> {
    const value = this.objects.get(key);
    if (value === undefined) return null;
    return { text: async () => value };
  }

  /** Test-only inspection helper; not part of the ObjectStore port. */
  has(key: string): boolean {
    return this.objects.has(key);
  }
}
