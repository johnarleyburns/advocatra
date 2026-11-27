# Contributing to Advocatra

<!-- SPDX-License-Identifier: AGPL-3.0-only -->

Advocatra is licensed under `AGPL-3.0-only`. Outside contributions require the
[Contributor License Agreement](CLA.md), confirmed through the CLA Assistant
check on your pull request. You keep your copyright and grant the project the
rights described there.

## Before you start

- Open or claim an issue. Small, single-purpose changes are much easier to
  review.
- Read [`CLAUDE.md`](CLAUDE.md) for the stack, commands and rules. It applies
  to humans and agents alike.
- This is a tax-representation case management tool. Taxpayer records, case
  documents and billing records are confidential by nature — never commit
  real client data, even anonymised-looking samples; use synthetic fixtures
  only.

## Test-first

1. Write the acceptance test and watch it fail for the right reason.
2. Write the smallest change that makes it pass.
3. Refactor with the suite green.

Every async dependency goes through an injected port/protocol. Unit tests use
deterministic fakes. Tests never sleep or read wall time.

## Local checks

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

## Pull requests

- One branch, one small PR, squash merge. Never push to `main`.
- Link the issue and include the failing test that now passes.
- Add the SPDX header to every file you create.
- New dependencies must be MIT, BSD, Apache, ISC, 0BSD or CC0. GPL, AGPL and
  unknown licences fail CI.
- Never commit secrets, `.dev.vars`, keys, tokens or taxpayer/client data.
  Use anonymised synthetic fixtures only.
- Do not deploy, tag, or touch environments, rulesets or secrets. The owner
  approves every release.

## Code style

- TypeScript strict mode; Swift 6 strict concurrency; Kotlin with no
  `android.*` imports in `core`.
- Prefer small modules with explicit ports over globals and module-level
  state.
- Accessibility, mobile-first layouts and light/dark themes are requirements,
  not polish.

## Reporting security issues

Do not open a public issue for a vulnerability, and especially not one that
could expose taxpayer or client data. Contact the owner privately via the
GitHub account `johnarleyburns`.
