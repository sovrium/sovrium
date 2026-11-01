/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two browser globals the bundle needs and Figma's sandbox may not have.
 *
 * Effect's `encoding/Base64` module builds a `TextEncoder` when it loads, and
 * since effect 4.1 a `TextDecoder` too; `effect/Schema` imports that module, so
 * the contract's schemas reach it. Figma's plugin sandbox has no
 * browser APIs (`facts.md`), so a bare sandbox would throw before the plugin
 * starts — `bundle.test.ts` runs the built `code.js` in one and caught exactly
 * that. A UTF-8 `encode` and `decode` are all the module calls, so that
 * is all this provides, and only when the host has none.
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

/** The bytes of a `BufferSource`, as `TextDecoder.prototype.decode` reads them. */
const bytesOf = (input: ArrayBuffer | ArrayBufferView | undefined): Uint8Array =>
  input === undefined
    ? new Uint8Array(0)
    : ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      : new Uint8Array(input)

/** Continuation bytes a lead byte announces, and the smallest code point it may encode. */
const leadOf = (byte: number): readonly [number, number] | undefined =>
  byte >= 0xc2 && byte <= 0xdf
    ? [1, 0x80]
    : byte >= 0xe0 && byte <= 0xef
      ? [2, 0x800]
      : byte >= 0xf0 && byte <= 0xf4
        ? [3, 0x10000]
        : undefined

/**
 * A string from UTF-8 bytes, as `TextDecoder.prototype.decode` returns it: a
 * leading byte-order mark is dropped, and malformed input becomes U+FFFD. The
 * platform splits an overlong or surrogate sequence into one U+FFFD per byte
 * where this gives one for the whole sequence; Effect only ever decodes the
 * ASCII its Base64 encoder wrote, so the difference never reaches the plugin.
 */
export const utf8Decode = (input?: ArrayBuffer | ArrayBufferView): string => {
  const bytes = bytesOf(input)
  const points: number[] = []
  let index = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  while (index < bytes.length) {
    const byte = bytes[index] ?? 0
    if (byte < 0x80) {
      points.push(byte)
      index += 1
      continue
    }
    const lead = leadOf(byte)
    if (lead === undefined) {
      points.push(0xfffd)
      index += 1
      continue
    }
    const [count, minimum] = lead
    let point = byte & (0x3f >> count)
    let read = 1
    while (read <= count && ((bytes[index + read] ?? 0) & 0xc0) === 0x80) {
      point = (point << 6) | ((bytes[index + read] ?? 0) & 0x3f)
      read += 1
    }
    const valid =
      read === count + 1 &&
      point >= minimum &&
      point <= 0x10ffff &&
      (point < 0xd800 || point > 0xdfff)
    points.push(valid ? point : 0xfffd)
    index += valid ? read : Math.max(1, read)
  }
  let text = ''
  for (let start = 0; start < points.length; start += 4096) {
    text += String.fromCodePoint(...points.slice(start, start + 4096))
  }
  return text
}

const host = globalThis as { TextEncoder?: unknown; TextDecoder?: unknown }

if (host.TextEncoder === undefined) {
  host.TextEncoder = class TextEncoder {
    readonly encoding = 'utf-8'
    encode(text = ''): Uint8Array {
      return utf8(text)
    }
  }
}

if (host.TextDecoder === undefined) {
  host.TextDecoder = class TextDecoder {
    readonly encoding = 'utf-8'
    decode(input?: ArrayBuffer | ArrayBufferView): string {
      return utf8Decode(input)
    }
  }
}
