#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
//
// Mechanically enforces CLAUDE.md hard limit #7: apps/web must never be
// able to decrypt taxpayer/case/billing data. @advocatra/vault is never
// allowed to be imported there at all (it's client-side only — the
// browser, not the server); @advocatra/crypto may be imported for
// EncryptedEnvelopeSchema (structural validation of ciphertext metadata)
// only — never for anything that reads, derives or uses the vault key.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED_CRYPTO_IMPORTS = new Set([
  "EncryptedEnvelopeSchema",
  "type EncryptedEnvelope",
]);

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "apps/web/src"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

const violations = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const importRegex =
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@advocatra\/(vault|crypto)["']/g;
  for (const match of text.matchAll(importRegex)) {
    const names = match[1];
    const pkg = match[2];
    if (pkg === "vault") {
      violations.push(
        `${file}: imports from @advocatra/vault (never allowed in apps/web)`,
      );
      continue;
    }
    const imported = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    for (const name of imported) {
      if (!ALLOWED_CRYPTO_IMPORTS.has(name)) {
        violations.push(
          `${file}: imports "${name}" from @advocatra/crypto (only EncryptedEnvelopeSchema is allowed)`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Decrypt-capability boundary violated:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(`check-no-decrypt-in-app: ${files.length} apps/web/src file(s) clean.`);
