<!-- SPDX-License-Identifier: AGPL-3.0-only -->
# Advocatra

Open-source IRS representation case management for solo EAs, CPAs and tax
attorneys — free, locally controlled, with an optional $20/month (or
$200/year) encrypted cloud sync service.

Advocatra is built as three independent implementations of one canonical,
open case/billing format: this web/cloud repo (TypeScript, Cloudflare
Workers), a native iOS app (`advocatra-ios`), and a native Android app
(`advocatra-android`). See [`docs/architecture/TECHNICAL-DESIGN.md`](docs/architecture/TECHNICAL-DESIGN.md)
for the full design, including why there is no shared cross-platform code.

Licensed AGPL-3.0-only. See [`CONTRIBUTING.md`](CONTRIBUTING.md) before
opening a pull request.

## Status

Foundational scaffold only: the canonical case and billing domain schema
(`packages/case`, `packages/billing`), unit-tested, plus a minimal health-
check Worker. Encrypted local storage, the cloud API, Stripe billing, cloud
sync and the UI are not yet implemented.

## Local development

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```
