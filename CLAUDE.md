<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# CLAUDE.md — Advocatra web/cloud (`johnarleyburns/advocatra`)

Advocatra is an open-source IRS representation case management tool for solo
EAs, CPAs and tax attorneys: TypeScript end to end on Cloudflare, with
native iOS and Android companion apps. The product is **Advocatra**.

This file is the contract for coding agents on the **web/cloud** track. The
iOS track lives in `johnarleyburns/advocatra-ios`, the Android track in
`johnarleyburns/advocatra-android`. All three mirror
`docs/architecture/TECHNICAL-DESIGN.md`.

## Source of truth

1. `docs/architecture/TECHNICAL-DESIGN.md` — the architecture baseline.
   Canonical case/billing schema, encryption model, sync protocol. If a
   decision here is missing or ambiguous, stop and ask; record it under
   that document's "Risks and open questions," don't invent behaviour.
2. This file.
3. The GitHub issue being worked. Its acceptance criteria are the
   definition of done.

## Stack

- **Runtime:** Cloudflare Workers (workerd), TypeScript.
- **Web:** Hono router.
- **Data:** `packages/case` and `packages/billing` define the canonical,
  versioned schema (Zod) as pure TypeScript — no Cloudflare, network or
  filesystem imports. Storage adapters (IndexedDB for the browser, Durable
  Object + R2 for the cloud copy) are a separate, later layer; do not
  conflate schema with storage.
- **Security boundary:** the cloud API, Durable Objects and R2 must never
  see plaintext taxpayer data or a vault encryption key. All
  encryption/decryption happens client-side (Web Crypto). This is stricter
  than Saldima's current production design and is non-negotiable — see
  `TECHNICAL-DESIGN.md` §2.
- **Tooling:** pnpm workspace, Vitest, Biome.
- **Payments:** Stripe (added when the billing/cloud milestone starts;
  not yet wired up).

### Repository layout

```
apps/web/src/
  index.ts               Hono app: /health, /signup, /webhook/stripe, and the
                          catch-all that resolves hostname -> tenantId (KV)
                          and forwards to that tenant's Vault DO
  auth.ts                 password hashing, sessions, TOTP (ported from Saldima)
  signup.ts                name/email validation, tenant host, Stripe checkout
                          + webhook signature verification (ported from Saldima)
  provision.ts             creates a tenant, writes KV, emails the setup link
                          (ported from Saldima's provisionBook, as provisionVault)
  accounts.ts              signup-completion/login/logout/session logic,
                          fully unit-testable via injected deps
  vault-do.ts              the Vault Durable Object, one per tenant — thin
                          routing only, see the hard rule below
  data-access/auth-store.ts  pure SQL-shaped helpers against an injected executor
  edge/tenant-lookup.ts     pure hostname -> tenantId resolution via KV
packages/
  case/                  canonical case schema: Taxpayer, Matter (+
                          TaxCourtDetails), Document, Correspondence, Task,
                          ActivityLogEntry
  billing/               canonical billing schema: FeeSchedule, Engagement,
                          TimeEntry, Retainer, Invoice, Payment, and the
                          fee-schedule guarantee-window invariant
  crypto/                Web Crypto key hierarchy (passphrase KDF, wrap/unwrap,
                          HKDF, AEAD envelope) — client-side only, never
                          imported by apps/web
  vault/                 manifest + snapshot assembly on packages/crypto —
                          client-side only, never imported by apps/web
  sync/                  revision + lease logic (pure)
  testkit/               fakes (Clock, IdGenerator, KV, SQL, fetch, email) —
                          apps/web depends on this for port type definitions,
                          same as Saldima's packages/testkit
docs/architecture/TECHNICAL-DESIGN.md
```

Boundary rules:

- `packages/*` never import `cloudflare:workers`, Hono or any network
  client; they run in plain Node and must stay testable without a Workers
  runtime.
- Views/routes (once they exist) never embed business rules — they call
  into `packages/case`/`packages/billing` and render plain objects.

## Commands

| Command          | Purpose                             |
| ---------------- | ----------------------------------- |
| `pnpm install`   | install the workspace               |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm lint`      | Biome check                         |
| `pnpm test`      | Vitest unit tests                   |

Never run a deploy command without an explicit, one-time owner request. See
"Hard limits" below.

## Test-first, always

- Write the failing acceptance test first, watch it fail for the right
  reason, then write the smallest code that passes, then refactor with the
  suite green.
- Every invariant in `packages/case`/`packages/billing` (balances, status
  transitions, the fee-schedule guarantee window) needs a test that proves
  it, not just a type that implies it.
- Tests never sleep, poll or read wall time; pass `now` explicitly where a
  function needs the current time (e.g. `canSupersedeFeeSchedule`).

## Data and money invariants

- Money amounts use a fixed-precision representation (integer cents or an
  equivalent exact type) — never a floating-point `number` for currency.
- IDs are opaque strings generated through an injected ID generator, never
  reused.
- SSN/EIN and other PII fields are part of the record schema but must never
  appear in any index, log, manifest or error message in the clear.
- `FeeSchedule.guaranteeDays` defaults to 30 and the UI must refuse to set
  it lower without an explicit, recorded override.

## License and dependencies

- Repo license: **AGPL-3.0-only**. Sole copyright retained by
  `johnarleyburns` through `CLA.md`; outside PRs require the CLA check.
- SPDX header on every file authored: `// SPDX-License-Identifier:
  AGPL-3.0-only` (or the correct comment syntax for the file type). Legal
  texts (`LICENSE`, `NOTICE`, `CLA.md`) are exempt.
- Dependencies must be MIT, BSD, Apache-2.0, ISC, 0BSD or CC0. GPL, AGPL,
  SSPL and unknown licenses fail CI.
- Advocatra is an independent implementation; it does not copy code from
  Saldima or any other project. Its architecture is consciously modeled on
  Saldima's public design (same author) — see `NOTICE`.

## Git and GitHub workflow

- **One task, one small branch, one PR, squash merge.** Never push to
  `main`.
- Use the `gh` CLI for every GitHub action.
- PR body: what changed, the failing test that now passes, gates run, and
  any issue requirement not covered (with reason).

## Hard limits for agents

1. **Never deploy, tag, upload, or touch secrets, environments or rulesets**
   without an explicit, one-time owner request for that specific action.
   Open PRs only otherwise. The owner approves every release.
2. Never create or modify GitHub Environments, repository rulesets, branch
   protection, deploy keys, or Actions secrets.
3. Never add a GPL/AGPL dependency or copy GPL code.
4. Never commit `.dev.vars`, keys, tokens, or any real taxpayer/client data.
   Use synthetic fixtures only.
5. Never guess a missing decision. Stop and ask, or record it under
   `TECHNICAL-DESIGN.md` §9 "Risks and open questions."
6. Never invent iOS/Android behaviour: schema changes land in this repo
   first and get mirrored by hand into the native repos in the same logical
   change.
7. **`vault-do.ts` (and anything added to it later) must never call a
   decrypt function from `packages/crypto` or `packages/vault`** —
   `decryptVaultSnapshot`, `decryptDocumentObject`, or anything requiring
   the vault key. The Vault DO stores and serves ciphertext only; it has
   no way to decrypt it and must stay that way. This is the literal
   mechanism behind the "server never sees unencrypted taxpayer data"
   claim — a PR that imports a decrypt function into any file under
   `apps/web/` is a security regression, not a feature, however the task
   was phrased.

## Definition of done (every PR)

- A test failed first and passes now; typecheck, lint and tests are green.
- `CLAUDE.md` and `TECHNICAL-DESIGN.md` are updated if a decision changed.
- No secrets, environments, rulesets, tags or deploys touched.

## Status

Foundational scaffold done: governance docs, `TECHNICAL-DESIGN.md`, and the
canonical case/billing/crypto/vault/sync packages with unit tests.

Cloud service, phase A done: tenant signup/provisioning (vanity subdomain +
KV host lookup, mirroring Saldima), the per-tenant `Vault` DO's account
routes (setup/login/logout/session), and Stripe Checkout + webhook
verification — all unit-tested via `packages/testkit` fakes, no real
Workers runtime or Stripe credentials required to test. `wrangler deploy
--dry-run` confirms the new KV/DO bindings and migration are valid config;
no real deploy without an explicit one-time ask.

Not yet implemented: wiring `packages/vault`/`packages/sync` into the
`Vault` DO (R2-backed snapshot upload/download), real Stripe product/
price/webhook secrets (owner-supplied), the wildcard DNS record vanity
subdomains need in dev/staging/production, and any UI.
