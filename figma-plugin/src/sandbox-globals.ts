/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one browser global the bundle needs and Figma's sandbox may not have.
 *
 * Effect's `encoding/Base64` module builds a `TextEncoder` when it loads, and
 * the contract's schemas reach that module. Figma's plugin sandbox has no
 * browser APIs (`facts.md`), so a bare sandbox would throw before the plugin
 * starts — `bundle.test.ts` runs the built `code.js` in one and caught exactly
 * that. A UTF-8 `encode` is all the module calls, so that is all this
 * provides, and only when the host has none.
 *
 * `code.ts` imports this file FIRST: the bundle evaluates modules in import
 * order, so the global exists before Effect's module body runs.
 */

/** UTF-8 bytes of a string, as `TextEncoder.prototype.encode` returns them. */
export const utf8 = (text: string): Uint8Array => {
  const bytes: number[] = []
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0
    if (point < 0x80) bytes.push(point)
    else if (point < 0x800) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f))
    else if (point < 0x10000) {
      bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f))
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f)
      )
    }
  }
  return Uint8Array.from(bytes)
}

const host = globalThis as { TextEncoder?: unknown }

if (host.TextEncoder === undefined) {
  host.TextEncoder = class TextEncoder {
    readonly encoding = 'utf-8'
    encode(text = ''): Uint8Array {
      return utf8(text)
    }
  }
}
