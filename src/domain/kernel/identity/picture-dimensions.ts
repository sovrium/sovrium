/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pixel size a picture declares in its own header — PNG, JPEG, GIF or
 * WebP — read without decoding it, so a template can place a picture at a
 * given width and keep its proportions.
 */

export interface PictureDimensions {
  readonly width: number
  readonly height: number
}

const u16be = (b: Uint8Array, at: number): number => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0)
const u16le = (b: Uint8Array, at: number): number => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
const u24le = (b: Uint8Array, at: number): number => u16le(b, at) | ((b[at + 2] ?? 0) << 16)
const u32be = (b: Uint8Array, at: number): number => u16be(b, at) * 65_536 + u16be(b, at + 2)

/** The low fourteen bits a WebP header stores a dimension in. */
const FOURTEEN_BITS = 0x3f_ff

const ascii = (b: Uint8Array, at: number, length: number): string =>
  String.fromCharCode(...b.subarray(at, at + length))

const sized = (width: number, height: number): PictureDimensions | undefined =>
  width > 0 && height > 0 ? { width, height } : undefined

/** PNG: the IHDR chunk, right after the signature. */
const png = (b: Uint8Array): PictureDimensions | undefined =>
  ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR'
    ? sized(u32be(b, 16), u32be(b, 20))
    : undefined

const gif = (b: Uint8Array): PictureDimensions | undefined =>
  ascii(b, 0, 4) === 'GIF8' ? sized(u16le(b, 6), u16le(b, 8)) : undefined

/** WebP: the lossy (`VP8 `), lossless (`VP8L`) or extended (`VP8X`) header. */
const webp = (b: Uint8Array): PictureDimensions | undefined => {
  if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return undefined
  const chunk = ascii(b, 12, 4)
  if (chunk === 'VP8 ') return sized(u16le(b, 26) & FOURTEEN_BITS, u16le(b, 28) & FOURTEEN_BITS)
  if (chunk === 'VP8L') {
    const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24)
    return sized((bits & FOURTEEN_BITS) + 1, ((bits >>> 14) & FOURTEEN_BITS) + 1)
  }
  return chunk === 'VP8X' ? sized(u24le(b, 24) + 1, u24le(b, 27) + 1) : undefined
}

/** A start-of-frame marker (baseline, progressive…), not a DHT, JPG or DAC one. */
const isStartOfFrame = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc

/** JPEG: walk the segments to the first start-of-frame. */
const jpegFrom = (b: Uint8Array, at: number): PictureDimensions | undefined => {
  if (at + 9 > b.length || b[at] !== 0xff) return undefined
  const marker = b[at + 1] ?? 0
  if (isStartOfFrame(marker)) return sized(u16be(b, at + 7), u16be(b, at + 5))
  return jpegFrom(b, at + 2 + u16be(b, at + 2))
}

const jpeg = (b: Uint8Array): PictureDimensions | undefined =>
  b[0] === 0xff && b[1] === 0xd8 ? jpegFrom(b, 2) : undefined

/** The size a PNG, JPEG, GIF or WebP declares, or `undefined` for anything else. */
export const pictureDimensions = (bytes: Uint8Array): PictureDimensions | undefined =>
  png(bytes) ?? jpeg(bytes) ?? gif(bytes) ?? webp(bytes)
