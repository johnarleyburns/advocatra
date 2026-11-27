// SPDX-License-Identifier: AGPL-3.0-only
import { FakeEmail, FakeKv } from "@advocatra/testkit";
import { describe, expect, it } from "vitest";
import { provisionTenant, TenantExistsError } from "./provision.ts";

function deps(overrides: Partial<Parameters<typeof provisionTenant>[0]> = {}) {
  return {
    kv: new FakeKv(),
    provisionVault: async (tenantId: string, _email: string) => ({
      setupToken: `setup-for-${tenantId}`,
    }),
    domain: "advocatra.com",
    suffix: "",
    ...overrides,
  };
}

describe("provisionTenant", () => {
  it("writes host-> and tenant-> KV entries and returns a setup URL", async () => {
    const kv = new FakeKv();
    const result = await provisionTenant(deps({ kv }), {
      name: "JaneDoe",
      email: "jane@example.com",
      plan: "monthly",
    });
    expect(result.host).toBe("janedoe.advocatra.com");
    expect(await kv.get("host:janedoe.advocatra.com")).toBe(result.tenantId);
    const tenantRaw = await kv.get(`tenant:${result.tenantId}`);
    expect(JSON.parse(tenantRaw ?? "{}")).toEqual({
      name: "JaneDoe",
      host: "janedoe.advocatra.com",
      plan: "monthly",
      email: "jane@example.com",
    });
    expect(result.setupUrl).toContain("https://janedoe.advocatra.com/app/setup?token=");
  });

  it("rejects a tenant host that already exists", async () => {
    const kv = new FakeKv();
    await provisionTenant(deps({ kv }), {
      name: "janedoe",
      email: "a@example.com",
      plan: "monthly",
    });
    await expect(
      provisionTenant(deps({ kv }), {
        name: "janedoe",
        email: "b@example.com",
        plan: "yearly",
      }),
    ).rejects.toBeInstanceOf(TenantExistsError);
  });

  it("emails the setup link when an email port is provided", async () => {
    const email = new FakeEmail();
    const result = await provisionTenant(deps({ email }), {
      name: "janedoe",
      email: "jane@example.com",
      plan: "monthly",
    });
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.to).toBe("jane@example.com");
    expect(email.sent[0]?.text).toContain(result.setupUrl);
  });

  it("does not throw if sending the email fails", async () => {
    const email = { send: async () => Promise.reject(new Error("smtp down")) };
    await expect(
      provisionTenant(deps({ email }), {
        name: "janedoe",
        email: "jane@example.com",
        plan: "monthly",
      }),
    ).resolves.toBeDefined();
  });
});
