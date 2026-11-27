// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Portable byte/base64 helpers. Deliberately built only on Web Crypto and
 * `btoa`/`atob` — available in the browser, in Cloudflare Workers, and in
 * Node (18+) for tests — so this package never needs a Node-only API like
 * `Buffer`.
 */

/**
 * Cryptographically random bytes. `crypto.getRandomValues` caps requests at
 * 65,536 bytes per call (a Web Crypto spec limit, not ours); this package
 * only ever uses it for key material and nonces, which are always far
 * smaller, so that cap is never a practical concern here.
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * `@types/node` widens the global `Uint8Array`'s buffer type parameter to
 * `ArrayBufferLike` (to accommodate `Buffer`), which the DOM lib's
 * `BufferSource` (used throughout `SubtleCrypto`) does not accept. Every
 * `Uint8Array` this package creates is actually backed by a plain
 * `ArrayBuffer` at runtime; this cast only tells TypeScript that.
 */
export function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}
