/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bytes of a PAdES seal inside a PDF, read and written without a parser.
 *
 * A sealed PDF carries a signature dictionary whose `/Contents` is a hex
 * string holding the CMS, and whose `/ByteRange [a b c d]` names the two
 * spans of the file the CMS signs: from `a` for `b` bytes, then from `c` for
 * `d` bytes. The gap between them is exactly the `/Contents` string, its
 * `<` and `>` included, so every byte of the file but the signature itself
 * is covered.
 *
 * The writer saves the document once with a placeholder of known shape: a
 * `/ByteRange` of four fixed-width numbers ({@link BYTE_RANGE_PLACEHOLDER})
 * and a `/Contents` of {@link SEAL_CONTENTS_BYTES} zero bytes. The saved file
 * fixes every offset, so the real `/ByteRange` is written over its
 * placeholder (padded with spaces to the same width), the SHA-256 of the two
 * spans is signed, and the CMS is written in hex over the zeros, the rest of
 * the string left `0`: no byte outside the `/Contents` changes after the
 * digest is taken.
 *
 * Pure: bytes in, bytes out.
 */

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

/** The room the `/Contents` placeholder holds for the CMS, in bytes (twice as many hex digits). */
export const SEAL_CONTENTS_BYTES = 16_384

/** The value each number of the `/ByteRange` placeholder holds: ten digits, wider than any offset. */
export const BYTE_RANGE_PLACEHOLDER = 9_999_999_999

/** The `/ByteRange` placeholder as the PDF writer spells the array. */
const BYTE_RANGE_PLACEHOLDER_TEXT = `/ByteRange [ 0 ${String(BYTE_RANGE_PLACEHOLDER)} ${String(BYTE_RANGE_PLACEHOLDER)} ${String(BYTE_RANGE_PLACEHOLDER)} ]`

/** The four numbers of a `/ByteRange`. */
export type ByteRange = readonly [number, number, number, number]

/** Where a saved document's seal goes: its byte range, and the `/Contents` string's bounds. */
export interface SealSlot {
  readonly byteRange: ByteRange
  /** Index of the `<` opening the `/Contents` string. */
  readonly contentsStart: number
  /** Index just past the `>` closing it. */
  readonly contentsEnd: number
}

const latin1 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('latin1')

/** `bytes` with `patch` written over it at `at`, as a new array: the length never changes. */
const overwrite = (bytes: Uint8Array, at: number, patch: Uint8Array): Uint8Array =>
  new Uint8Array(Buffer.concat([bytes.subarray(0, at), patch, bytes.subarray(at + patch.length)]))

/**
 * Fix the placeholder `/ByteRange` of a document saved with a seal
 * placeholder written at or after `from`: the document with its real byte
 * range written in, and the slot the CMS goes into. `undefined` when the
 * placeholder is not found where the writer puts it.
 */
export const fixSealSlot = (
  saved: Uint8Array,
  from: number
): { readonly bytes: Uint8Array; readonly slot: SealSlot } | undefined => {
  const text = latin1(saved)
  const rangeAt = text.indexOf(BYTE_RANGE_PLACEHOLDER_TEXT, from)
  const contentsAt = text.indexOf('/Contents <', from)
  if (rangeAt < 0 || contentsAt < 0) return undefined
  const contentsStart = contentsAt + '/Contents '.length
  const close = text.indexOf('>', contentsStart)
  if (close - contentsStart - 1 !== SEAL_CONTENTS_BYTES * 2) return undefined
  const contentsEnd = close + 1
  const byteRange: ByteRange = [0, contentsStart, contentsEnd, saved.length - contentsEnd]
  const spelled = `/ByteRange [ ${byteRange.join(' ')} ]`.padEnd(
    BYTE_RANGE_PLACEHOLDER_TEXT.length,
    ' '
  )
  const bytes = overwrite(saved, rangeAt, Buffer.from(spelled, 'latin1'))
  return { bytes, slot: { byteRange, contentsStart, contentsEnd } }
}

/** The bytes a `/ByteRange` covers: its two spans, joined. */
export const signedSpans = (bytes: Uint8Array, byteRange: ByteRange): Uint8Array => {
  const [firstStart, firstLength, secondStart, secondLength] = byteRange
  return new Uint8Array(
    Buffer.concat([
      bytes.subarray(firstStart, firstStart + firstLength),
      bytes.subarray(secondStart, secondStart + secondLength),
    ])
  )
}

/** The document with `cms` written in hex into its slot; `undefined` when it does not fit. */
export const withSealContents = (
  bytes: Uint8Array,
  slot: SealSlot,
  cms: Uint8Array
): Uint8Array | undefined => {
  if (cms.length > SEAL_CONTENTS_BYTES) return undefined
  const hex = Buffer.from(cms)
    .toString('hex')
    .toUpperCase()
    .padEnd(SEAL_CONTENTS_BYTES * 2, '0')
  return overwrite(bytes, slot.contentsStart + 1, Buffer.from(hex, 'latin1'))
}

/** The total length of the DER element `bytes` starts with, or `undefined`. */
const derElementLength = (bytes: Uint8Array): number | undefined => {
  const first = bytes[1]
  if (first === undefined) return undefined
  if (first < 0x80) return 2 + first
  const count = first & 0x7f
  if (count === 0 || count > 4 || bytes.length < 2 + count) return undefined
  const length = Array.from(bytes.subarray(2, 2 + count)).reduce(
    (total, octet) => total * 256 + octet,
    0
  )
  return 2 + count + length
}

/** The last signature of a PDF: its byte range and its CMS, as written. */
export interface PdfSignature {
  readonly byteRange: ByteRange
  readonly cms: Uint8Array
  /** Whether the byte range covers the whole file but the `/Contents` string. */
  readonly coversWholeFile: boolean
}

const BYTE_RANGE = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g

/**
 * The last signature `bytes` carries, read from its `/ByteRange`: the gap the
 * range leaves must be one hex string, which holds the CMS. `undefined` when
 * the file carries no signature that reads.
 */
export const lastPdfSignature = (bytes: Uint8Array): PdfSignature | undefined => {
  const text = latin1(bytes)
  const match = [...text.matchAll(BYTE_RANGE)].at(-1)
  if (match === undefined) return undefined
  const byteRange: ByteRange = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
  ]
  const [firstStart, firstLength, secondStart, secondLength] = byteRange
  const gap = text.slice(firstStart + firstLength, secondStart)
  if (!/^<[0-9A-Fa-f]*>$/.test(gap)) return undefined
  const raw = Buffer.from(gap.slice(1, -1), 'hex')
  const length = derElementLength(raw)
  if (length === undefined || length > raw.length) return undefined
  return {
    byteRange,
    cms: new Uint8Array(raw.subarray(0, length)),
    coversWholeFile: firstStart === 0 && secondStart + secondLength === bytes.length,
  }
}

/** The bytes a timestamp of a chain head stamps: the head hash itself, as 32 octets. */
export const chainHeadImprint = (headHash: string): Uint8Array =>
  new Uint8Array(Buffer.from(headHash, 'hex'))

/** SHA-256 of `bytes`, as 32 octets. */
export const sha256Bytes = (bytes: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha256').update(bytes).digest())

/** The PAdES baseline level a seal reached: none, B-B, or B-T with a timestamp of its signature. */
export type SealLevel = 'none' | 'b-b' | 'b-t'
