// SPDX-License-Identifier: AGPL-3.0-only
import { FakeKv } from "@advocatra/testkit";
import { describe, expect, it } from "vitest";
import { resolveTenantId, resolveTenantMetadata } from "./tenant-lookup.ts";

describe("resolveTenantId", () => {
  it("returns the tenant id for a known host", async () => {
    const kv = new FakeKv();
    await kv.put("host:janedoe.advocatra.com", "tenant-abc");
    expect(await resolveTenantId(kv, "janedoe.advocatra.com")).toBe("tenant-abc");
  });

  it("returns null for an unknown host", async () => {
    const kv = new FakeKv();
    expect(await resolveTenantId(kv, "nobody.advocatra.com")).toBeNull();
  });
});

describe("resolveTenantMetadata", () => {
  it("parses the stored tenant metadata", async () => {
    const kv = new FakeKv();
    await kv.put(
      "tenant:tenant-abc",
      JSON.stringify({
        name: "janedoe",
        host: "janedoe.advocatra.com",
        plan: "monthly",
        email: "jane@example.com",
      }),
    );
    expect(await resolveTenantMetadata(kv, "tenant-abc")).toEqual({
      name: "janedoe",
      host: "janedoe.advocatra.com",
      plan: "monthly",
      email: "jane@example.com",
    });
  });

  it("returns null for an unknown tenant id", async () => {
    const kv = new FakeKv();
    expect(await resolveTenantMetadata(kv, "nope")).toBeNull();
  });
});
