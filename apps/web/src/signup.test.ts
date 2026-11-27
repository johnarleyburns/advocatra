// SPDX-License-Identifier: AGPL-3.0-only

import { FakeFetch } from "@advocatra/testkit";
import { describe, expect, it } from "vitest";
import {
  checkoutParams,
  createStripeCheckout,
  normalizeName,
  RESERVED_NAMES,
  tenantHost,
  validateEmail,
  validateName,
  verifyStripeSignature,
} from "./signup.ts";

describe("validateName", () => {
  it("accepts a normal name", () => {
    expect(validateName("janedoe")).toBeNull();
  });

  it("rejects a name that's too short", () => {
    expect(validateName("ab")).not.toBeNull();
  });

  it("rejects an uppercase/invalid-character name", () => {
    expect(validateName("Jane_Doe!")).not.toBeNull();
  });

  it("rejects every reserved name", () => {
    for (const reserved of RESERVED_NAMES) {
      expect(validateName(reserved)).not.toBeNull();
    }
  });
});

describe("normalizeName / tenantHost", () => {
  it("lowercases and trims", () => {
    expect(normalizeName("  JaneDoe  ")).toBe("janedoe");
  });

  it("builds the vanity host", () => {
    expect(tenantHost("JaneDoe", "advocatra.com")).toBe("janedoe.advocatra.com");
    expect(tenantHost("JaneDoe", "advocatra.com", "-dev")).toBe(
      "janedoe-dev.advocatra.com",
    );
  });
});

describe("validateEmail", () => {
  it("accepts a well-formed email", () => {
    expect(validateEmail("jane@example.com")).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(validateEmail("not-an-email")).toBe(false);
  });
});

describe("checkoutParams", () => {
  const prices = { monthly: "price_monthly_123", yearly: "price_yearly_456" };

  it("selects the monthly price for a monthly plan", () => {
    const params = checkoutParams(
      { name: "janedoe", email: "jane@example.com", plan: "monthly" },
      "https://advocatra.com",
      prices,
    );
    expect(params.get("line_items[0][price]")).toBe("price_monthly_123");
  });

  it("selects the yearly price for a yearly plan", () => {
    const params = checkoutParams(
      { name: "janedoe", email: "jane@example.com", plan: "yearly" },
      "https://advocatra.com",
      prices,
    );
    expect(params.get("line_items[0][price]")).toBe("price_yearly_456");
  });
});

describe("createStripeCheckout", () => {
  it("returns the checkout session from a successful Stripe response", async () => {
    const fakeFetch = new FakeFetch().queueJson(200, {
      id: "cs_test_1",
      url: "https://checkout.stripe.test/1",
    });
    const session = await createStripeCheckout(
      fakeFetch.fetch,
      "sk_test_123",
      { name: "janedoe", email: "jane@example.com", plan: "monthly" },
      "https://advocatra.com",
      { monthly: "price_monthly_123", yearly: "price_yearly_456" },
    );
    expect(session).toEqual({ id: "cs_test_1", url: "https://checkout.stripe.test/1" });
    expect(fakeFetch.requests[0]?.url).toBe(
      "https://api.stripe.com/v1/checkout/sessions",
    );
  });

  it("throws with Stripe's error message on failure", async () => {
    const fakeFetch = new FakeFetch().queueJson(402, {
      error: { message: "card declined" },
    });
    await expect(
      createStripeCheckout(
        fakeFetch.fetch,
        "sk_test_123",
        { name: "janedoe", email: "jane@example.com", plan: "monthly" },
        "https://advocatra.com",
        { monthly: "price_monthly_123", yearly: "price_yearly_456" },
      ),
    ).rejects.toThrow("card declined");
  });
});

describe("verifyStripeSignature", () => {
  async function sign(
    payload: string,
    secret: string,
    timestamp: number,
  ): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signed = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${timestamp}.${payload}`),
      ),
    );
    return Array.from(signed, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("accepts a correctly signed, fresh payload", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const secret = "whsec_test";
    const nowMs = Date.UTC(2027, 0, 1);
    const timestamp = Math.floor(nowMs / 1000);
    const signature = await sign(payload, secret, timestamp);
    const header = `t=${timestamp},v1=${signature}`;
    expect(await verifyStripeSignature(payload, header, secret, nowMs)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const secret = "whsec_test";
    const nowMs = Date.UTC(2027, 0, 1);
    const timestamp = Math.floor(nowMs / 1000);
    const signature = await sign(payload, secret, timestamp);
    const header = `t=${timestamp},v1=${signature}`;
    const tamperedPayload = JSON.stringify({ type: "checkout.session.expired" });
    expect(await verifyStripeSignature(tamperedPayload, header, secret, nowMs)).toBe(
      false,
    );
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const secret = "whsec_test";
    const nowMs = Date.UTC(2027, 0, 1);
    const oldTimestamp = Math.floor(nowMs / 1000) - 10_000; // way outside 300s tolerance
    const signature = await sign(payload, secret, oldTimestamp);
    const header = `t=${oldTimestamp},v1=${signature}`;
    expect(await verifyStripeSignature(payload, header, secret, nowMs)).toBe(false);
  });

  it("rejects a header with no signatures", async () => {
    expect(await verifyStripeSignature("{}", "t=123", "secret", Date.now())).toBe(
      false,
    );
  });
});
