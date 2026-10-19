/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AudioExtractReason } from '@/application/ports/services/audio-track-extractor'

/**
 * Byte-level helpers the audio remux shares: big-endian reads over a
 * `Uint8Array` view, the one refusal it throws, and the concatenation of the
 * parts it writes. Every read checks its bounds, so a truncated file is a
 * `malformed` refusal rather than a garbage value.
 */

/**
 * The most audio frames one remux reads: about a day of sound at 48 kHz AAC
 * (1024-sample frames) or 20 ms Opus packets, far past what a 100 MiB video
 * holds. A sample table or a fragment run declaring more is refused before
 * it is read, so a few bytes of header can never make the remux index
 * billions of samples.
 */
export const MAX_AUDIO_FRAMES = 2 ** 22

/**
 * The most entries one box or element list holds. A file made of nothing
 * but empty 2-byte elements would otherwise cost dozens of times its own
 * size in memory to list; a real recording stays orders of magnitude below.
 */
export const MAX_LIST_ENTRIES = 2 ** 20

/** A remux refusal, thrown inside the parsers and turned into a typed error at the adapter. */
export class RemuxRefusal extends Error {
  readonly reason: AudioExtractReason
  readonly codec: string | undefined
  readonly hadVideo: boolean

  constructor(
    reason: AudioExtractReason,
    message: string,
    options: { readonly codec?: string; readonly hadVideo?: boolean } = {}
  ) {
    super(message)
    this.reason = reason
    this.codec = options.codec
    this.hadVideo = options.hadVideo ?? false
  }
}

/** Refuse a file whose structure cannot be read. */
export const malformed = (detail: string): never => {
  throw new RemuxRefusal('malformed', detail)
}

/** Fail as malformed unless `[at, at + length)` lies inside `bytes`. */
export const ensureRange = (bytes: Uint8Array, at: number, length: number): void => {
  if (at < 0 || length < 0 || at + length > bytes.length) {
    malformed(`the file ends inside a structure at byte ${String(at)}`)
  }
}

/** Refuse a count of `what` past `max`, before anything is sized from it. */
export const ensureCount = (count: number, max: number, what: string): void => {
  if (count > max) malformed(`the file declares ${String(count)} ${what}, more than ${String(max)}`)
}

/** An unsigned big-endian integer of `length` bytes (at most 6, or 8 when it fits 2^53). */
export const readUint = (bytes: Uint8Array, at: number, length: number): number => {
  ensureRange(bytes, at, length)
  let value = 0
  for (let i = 0; i < length; i++) value = value * 256 + bytes[at + i]!
  if (!Number.isSafeInteger(value)) malformed(`an integer at byte ${String(at)} is too large`)
  return value
}

export const u8 = (bytes: Uint8Array, at: number): number => readUint(bytes, at, 1)
export const u16 = (bytes: Uint8Array, at: number): number => readUint(bytes, at, 2)
export const u32 = (bytes: Uint8Array, at: number): number => readUint(bytes, at, 4)
export const u64 = (bytes: Uint8Array, at: number): number => readUint(bytes, at, 8)

/** A signed 32-bit big-endian integer. */
export const i32 = (bytes: Uint8Array, at: number): number => {
  const value = u32(bytes, at)
  return value >= 0x80_00_00_00 ? value - 0x1_00_00_00_00 : value
}

/** A signed 64-bit big-endian integer, refused when it does not fit a double exactly. */
export const i64 = (bytes: Uint8Array, at: number): number => {
  ensureRange(bytes, at, 8)
  const view = new DataView(bytes.buffer, bytes.byteOffset + at, 8)
  const value = view.getBigInt64(0)
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    malformed(`an integer at byte ${String(at)} is too large`)
  }
  return Number(value)
}

/** `length` bytes read as Latin-1 text (a four-character code, a codec id). */
export const latin1 = (bytes: Uint8Array, at: number, length: number): string => {
  ensureRange(bytes, at, length)
  let text = ''
  for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[at + i]!)
  return text
}

/** `text` as Latin-1 bytes. */
export const latin1Bytes = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff
  return out
}

/** `value` as an unsigned big-endian integer of `length` bytes. */
export const uintBytes = (value: number, length: number): Uint8Array => {
  const out = new Uint8Array(length)
  let rest = value
  for (let i = length - 1; i >= 0; i--) {
    out[i] = rest % 256
    rest = Math.floor(rest / 256)
  }
  return out
}

/** The parts laid end to end in one new buffer: a single allocation, a single copy each. */
export const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  let total = 0
  for (const part of parts) total += part.length
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
