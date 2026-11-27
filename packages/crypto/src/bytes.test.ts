// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  randomBytes,
  utf8ToBytes,
} from "./bytes.ts";

describe("base64 round trip", () => {
  it("round-trips arbitrary bytes, including across the chunking boundary", () => {
    // 70,000 bytes > bytesToBase64's 0x8000 chunk size. crypto.getRandomValues
    // caps at 65,536 bytes per call, so build this deterministically instead.
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("round-trips an empty byte array", () => {
    const bytes = new Uint8Array(0);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});

describe("utf8 round trip", () => {
  it("round-trips text with non-ASCII characters", () => {
    const text = "CP2000 notice — tax year 2026";
    expect(bytesToUtf8(utf8ToBytes(text))).toBe(text);
  });
});

describe("randomBytes", () => {
  it("returns the requested length and is not all zero", () => {
    const bytes = randomBytes(32);
    expect(bytes.length).toBe(32);
    expect(bytes.some((b) => b !== 0)).toBe(true);
  });

  it("is not deterministic across calls", () => {
    expect(randomBytes(32)).not.toEqual(randomBytes(32));
  });
});
