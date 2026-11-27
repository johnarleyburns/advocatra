// SPDX-License-Identifier: AGPL-3.0-only
import { Hono } from "hono";
import { resolveTenantId } from "./edge/tenant-lookup.ts";
import { provisionTenant } from "./provision.ts";
import type { SignupInput } from "./signup.ts";
import {
  createStripeCheckout,
  validateEmail,
  validateName,
  verifyStripeSignature,
} from "./signup.ts";
import { Vault } from "./vault-do.ts";

export { Vault };

interface Env {
  KV: KVNamespace;
  VAULT: DurableObjectNamespace<Vault>;
  APP_DOMAIN: string;
  APP_SUFFIX: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_MONTHLY?: string;
  STRIPE_PRICE_YEARLY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}

export const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

// POST /signup — validates input and starts a Stripe Checkout session.
// Provisioning the tenant (creating its Vault DO, writing the KV host
// entry) happens from the Stripe webhook below, once payment succeeds —
// never before, so an unpaid signup attempt never reserves a tenant name.
app.post("/signup", async (c) => {
  const body = await c.req.json<SignupInput>();
  const nameError = validateName(body.name);
  if (nameError) return c.json({ ok: false, error: nameError }, 400);
  if (!validateEmail(body.email))
    return c.json({ ok: false, error: "Enter a valid email address." }, 400);
  if (body.plan !== "monthly" && body.plan !== "yearly") {
    return c.json({ ok: false, error: "Choose a monthly or yearly plan." }, 400);
  }
  if (
    !c.env.STRIPE_SECRET_KEY ||
    !c.env.STRIPE_PRICE_MONTHLY ||
    !c.env.STRIPE_PRICE_YEARLY
  ) {
    return c.json(
      { ok: false, error: "Billing is not configured in this environment." },
      503,
    );
  }
  try {
    const session = await createStripeCheckout(
      fetch,
      c.env.STRIPE_SECRET_KEY,
      body,
      new URL(c.req.url).origin,
      { monthly: c.env.STRIPE_PRICE_MONTHLY, yearly: c.env.STRIPE_PRICE_YEARLY },
    );
    return c.json({ ok: true, checkoutUrl: session.url });
  } catch (error) {
    return c.json({ ok: false, error: (error as Error).message }, 502);
  }
});

// POST /webhook/stripe — on checkout.session.completed, provisions the tenant.
app.post("/webhook/stripe", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET)
    return c.json({ ok: false, error: "not configured" }, 503);
  const signatureHeader = c.req.header("Stripe-Signature");
  const payload = await c.req.text();
  if (
    !signatureHeader ||
    !(await verifyStripeSignature(
      payload,
      signatureHeader,
      c.env.STRIPE_WEBHOOK_SECRET,
      Date.now(),
    ))
  ) {
    return c.json({ ok: false, error: "invalid signature" }, 400);
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: {
      object: { metadata?: { tenantName?: string; email?: string; plan?: string } };
    };
  };
  if (event.type !== "checkout.session.completed")
    return c.json({ ok: true, skipped: true });

  const metadata = event.data.object.metadata ?? {};
  const { tenantName, email, plan } = metadata;
  if (!tenantName || !email || (plan !== "monthly" && plan !== "yearly")) {
    return c.json({ ok: false, error: "missing metadata on checkout session" }, 400);
  }

  const result = await provisionTenant(
    {
      kv: c.env.KV,
      domain: c.env.APP_DOMAIN,
      suffix: c.env.APP_SUFFIX,
      provisionVault: async (tenantId, tenantEmail) => {
        const id = c.env.VAULT.idFromName(tenantId);
        const stub = c.env.VAULT.get(id);
        const response = await stub.fetch("https://vault.internal/setup/provision", {
          method: "POST",
          headers: {
            "X-Advocatra-Tenant-Id": tenantId,
            "content-type": "application/json",
          },
          body: JSON.stringify({ email: tenantEmail }),
        });
        return response.json();
      },
    },
    { name: tenantName, email, plan },
  );
  return c.json({ ok: true, host: result.host });
});

// Everything else routes to the tenant's own Vault DO, resolved by hostname.
app.all("*", async (c) => {
  const host = new URL(c.req.url).host;
  const tenantId = await resolveTenantId(c.env.KV, host);
  if (!tenantId) return c.json({ ok: false, error: "unknown host" }, 404);

  const id = c.env.VAULT.idFromName(tenantId);
  const stub = c.env.VAULT.get(id);
  const forwarded = new Request(c.req.raw);
  forwarded.headers.set("X-Advocatra-Tenant-Id", tenantId);
  return stub.fetch(forwarded);
});

export default app;
