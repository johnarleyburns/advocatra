// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  acquireLease,
  canAcquireLease,
  DEFAULT_LEASE_DURATION_MS,
  isLeaseExpired,
} from "./lease.ts";

const now = new Date("2027-03-01T12:00:00Z");

describe("canAcquireLease", () => {
  it("allows acquiring when there is no current lease", () => {
    expect(canAcquireLease(null, "device-a", now)).toBe(true);
  });

  it("allows the same device to renew", () => {
    const lease = acquireLease("vault-1", "device-a", now);
    expect(canAcquireLease(lease, "device-a", now)).toBe(true);
  });

  it("blocks a different device while the lease is active", () => {
    const lease = acquireLease("vault-1", "device-a", now);
    expect(canAcquireLease(lease, "device-b", now)).toBe(false);
  });

  it("allows a different device once the lease has expired", () => {
    const lease = acquireLease("vault-1", "device-a", now);
    const afterExpiry = new Date(now.getTime() + DEFAULT_LEASE_DURATION_MS + 1);
    expect(canAcquireLease(lease, "device-b", afterExpiry)).toBe(true);
  });
});

describe("isLeaseExpired", () => {
  it("is false right after acquiring", () => {
    const lease = acquireLease("vault-1", "device-a", now);
    expect(isLeaseExpired(lease, now)).toBe(false);
  });

  it("is true once the duration has elapsed", () => {
    const lease = acquireLease("vault-1", "device-a", now);
    const later = new Date(now.getTime() + DEFAULT_LEASE_DURATION_MS);
    expect(isLeaseExpired(lease, later)).toBe(true);
  });
});

describe("acquireLease", () => {
  it("sets expiresAt to acquiredAt plus the given duration", () => {
    const lease = acquireLease("vault-1", "device-a", now, 60_000);
    expect(
      new Date(lease.expiresAt).getTime() - new Date(lease.acquiredAt).getTime(),
    ).toBe(60_000);
  });
});
