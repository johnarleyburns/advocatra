// SPDX-License-Identifier: AGPL-3.0-only
import type { KeyValueStore } from "@advocatra/testkit";

/** Resolve a request's hostname to a tenant id via the `host:<host>` KV entry `provisionTenant` writes. */
export async function resolveTenantId(
  kv: KeyValueStore,
  host: string,
): Promise<string | null> {
  return kv.get(`host:${host}`);
}

export interface TenantMetadata {
  readonly name: string;
  readonly host: string;
  readonly plan: string;
  readonly email: string;
}

export async function resolveTenantMetadata(
  kv: KeyValueStore,
  tenantId: string,
): Promise<TenantMetadata | null> {
  const raw = await kv.get(`tenant:${tenantId}`);
  if (!raw) return null;
  return JSON.parse(raw) as TenantMetadata;
}
