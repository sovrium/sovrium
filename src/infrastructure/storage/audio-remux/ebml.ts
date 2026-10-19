/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  concatBytes,
  ensureCount,
  ensureRange,
  latin1,
  malformed,
  MAX_LIST_ENTRIES,
  readUint,
  uintBytes,
} from './media-bytes'

/**
 * EBML (RFC 8794), the element tree Matroska and WebM are written in: an
 * element is a variable-length id, a variable-length size, then its payload.
 * A size whose value bits are all ones is UNKNOWN — the element runs until an
 * element that cannot be its child starts — which live recorders write for
 * the Segment and its Clusters.
 */

export const EBML_ID = {
  header: 0x1a_45_df_a3,
  ebmlVersion: 0x42_86,
  ebmlReadVersion: 0x42_f7,
  ebmlMaxIdLength: 0x42_f2,
  ebmlMaxSizeLength: 0x42_f3,
  docType: 0x42_82,
  docTypeVersion: 0x42_87,
  docTypeReadVersion: 0x42_85,
  segment: 0x18_53_80_67,
  seekHead: 0x11_4d_9b_74,
  seek: 0x4d_bb,
  seekId: 0x53_ab,
  seekPosition: 0x53_ac,
  info: 0x15_49_a9_66,
  timecodeScale: 0x2a_d7_b1,
  duration: 0x44_89,
  muxingApp: 0x4d_80,
  writingApp: 0x57_41,
  tracks: 0x16_54_ae_6b,
  trackEntry: 0xae,
  trackNumber: 0xd7,
  trackType: 0x83,
  codecId: 0x86,
  defaultDuration: 0x23_e3_83,
  cluster: 0x1f_43_b6_75,
  timecode: 0xe7,
  simpleBlock: 0xa3,
  blockGroup: 0xa0,
  block: 0xa1,
  blockDuration: 0x9b,
  cues: 0x1c_53_bb_6b,
  cuePoint: 0xbb,
  cueTime: 0xb3,
  cueTrackPositions: 0xb7,
  cueTrack: 0xf7,
  cueClusterPosition: 0xf1,
  void: 0xec,
  crc32: 0xbf,
} as const

/** The Segment's own children: an unknown-size Cluster ends where one of these starts. */
export const TOP_LEVEL_IDS: ReadonlySet<number> = new Set([
  EBML_ID.seekHead,
  EBML_ID.info,
  EBML_ID.tracks,
  EBML_ID.cluster,
  EBML_ID.cues,
  0x12_54_c3_67, // Tags
  0x10_43_a7_70, // Chapters
  0x19_41_a4_69, // Attachments
  EBML_ID.segment,
  EBML_ID.header,
])

export interface Vint {
  readonly value: number
  readonly length: number
  readonly unknown: boolean
}

/** A variable-length integer at `at`: an id keeps its length marker, a size drops it. */
export const readVint = (bytes: Uint8Array, at: number, keepMarker: boolean): Vint => {
  ensureRange(bytes, at, 1)
  const first = bytes[at]!
  const length = Math.clz32(first) - 23
  if (length < 1 || length > 8) return malformed(`an EBML integer at byte ${String(at)} is invalid`)
  const lead = keepMarker ? first : first & (0xff >> length)
  ensureRange(bytes, at, length)
  // All value bits set is the UNKNOWN size: told apart before the integer is
  // built, since an 8-byte one does not fit a double exactly.
  if (
    !keepMarker &&
    lead === 0xff >> length &&
    bytes.subarray(at + 1, at + length).every((b) => b === 0xff)
  ) {
    return { value: 0, length, unknown: true }
  }
  const rest = length > 1 ? readUint(bytes, at + 1, length - 1) : 0
  const value = lead * 2 ** (8 * (length - 1)) + rest
  if (!Number.isSafeInteger(value))
    return malformed(`an EBML integer at byte ${String(at)} is too large`)
  return { value, length, unknown: false }
}

export interface Element {
  readonly id: number
  /** The offset of the element's first id byte. */
  readonly start: number
  /** The offset of its payload's first byte. */
  readonly payload: number
  /** The offset one past its last byte (for an unknown size, where the next sibling starts). */
  readonly end: number
}

/** The element header at `at`, with its size resolved against `limit` when it is unknown. */
const readHeader = (
  bytes: Uint8Array,
  at: number,
  limit: number
): { readonly id: number; readonly payload: number; readonly size: Vint } => {
  const id = readVint(bytes, at, true)
  const size = readVint(bytes, at + id.length, false)
  const payload = at + id.length + size.length
  if (payload > limit) malformed(`an EBML element at byte ${String(at)} overruns its parent`)
  return { id: id.value, payload, size }
}

/** Where an unknown-size element starting its payload at `from` ends: at the next top-level id. */
const scanToTopLevel = (bytes: Uint8Array, from: number, limit: number): number => {
  let at = from
  while (at < limit) {
    const { id, payload, size } = readHeader(bytes, at, limit)
    if (TOP_LEVEL_IDS.has(id)) return at
    if (size.unknown)
      return malformed(`an unknown-size element inside an unknown-size one at byte ${String(at)}`)
    at = Math.min(payload + size.value, limit)
  }
  return limit
}

/**
 * The elements laid end to end in `bytes[from, to)`, unknown sizes resolved;
 * a list past {@link MAX_LIST_ENTRIES} elements is malformed.
 */
export const elementsIn = (bytes: Uint8Array, from: number, to: number): readonly Element[] => {
  const elements: Element[] = []
  let at = from
  while (at < to) {
    // A trailing run of zero bytes (padding a recorder left) ends the list.
    if (bytes[at] === 0) break
    const { id, payload, size } = readHeader(bytes, at, to)
    const end = size.unknown
      ? id === EBML_ID.segment
        ? to
        : scanToTopLevel(bytes, payload, to)
      : payload + size.value
    if (end > to) malformed(`the EBML element 0x${id.toString(16)} overruns its parent`)
    ensureCount(elements.length + 1, MAX_LIST_ENTRIES, 'elements side by side')
    // eslint-disable-next-line no-restricted-syntax -- sanctioned mutation: appending each element to one array keeps a parse linear
    elements.push({ id, start: at, payload, end })
    at = end
  }
  return elements
}

/** The first child of `parent` with `id`. */
export const childElement = (
  bytes: Uint8Array,
  parent: Element | undefined,
  id: number
): Element | undefined =>
  parent === undefined
    ? undefined
    : elementsIn(bytes, parent.payload, parent.end).find((element) => element.id === id)

/** An unsigned integer element's value. */
export const uintValue = (bytes: Uint8Array, element: Element): number =>
  element.end === element.payload
    ? 0
    : readUint(bytes, element.payload, element.end - element.payload)

/** A float element's value (4 or 8 bytes; empty is 0). */
export const floatValue = (bytes: Uint8Array, element: Element): number => {
  const length = element.end - element.payload
  if (length === 0) return 0
  ensureRange(bytes, element.payload, length)
  const view = new DataView(bytes.buffer, bytes.byteOffset + element.payload, length)
  if (length === 4) return view.getFloat32(0)
  if (length === 8) return view.getFloat64(0)
  return malformed(`a ${String(length)}-byte float`)
}

/** A string element's value, trailing NULs dropped. */
export const stringValue = (bytes: Uint8Array, element: Element): string =>
  latin1(bytes, element.payload, element.end - element.payload).replace(/\0+$/, '')

// ── writing ──

/** An id's bytes: its own marker already encodes its length. */
const idBytes = (id: number): Uint8Array => {
  const length = id >= 0x10_00_00_00 ? 4 : id >= 0x20_00_00 ? 3 : id >= 0x40_00 ? 2 : 1
  return uintBytes(id, length)
}

/** A size as the shortest vint that is not the all-ones UNKNOWN marker. */
export const sizeBytes = (size: number, minLength = 1): Uint8Array => {
  let length = Math.max(1, minLength)
  while (length < 8 && size >= 2 ** (7 * length) - 1) length++
  const marked = 2 ** (7 * length) + size
  const out = uintBytes(marked, length)
  return out
}

/** An element of `id` around `parts`. */
export const writeElement = (id: number, parts: readonly Uint8Array[]): Uint8Array => {
  const size = parts.reduce((total, part) => total + part.length, 0)
  return concatBytes([idBytes(id), sizeBytes(size), ...parts])
}

/** An unsigned integer element, in the fewest bytes (or exactly `length`). */
export const writeUint = (id: number, value: number, length?: number): Uint8Array => {
  let bytes = length ?? 1
  while (length === undefined && bytes < 8 && value >= 2 ** (8 * bytes)) bytes++
  return writeElement(id, [uintBytes(value, bytes)])
}

/** A 64-bit float element. */
export const writeFloat = (id: number, value: number): Uint8Array => {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setFloat64(0, value)
  return writeElement(id, [out])
}

/** A string element. */
export const writeString = (id: number, value: string): Uint8Array =>
  writeElement(id, [new TextEncoder().encode(value)])

/** The bytes of an element as stored, header included. */
export const elementBytes = (bytes: Uint8Array, element: Element): Uint8Array =>
  bytes.subarray(element.start, element.end)

/** An element's id as the bytes it is written with. */
export const elementIdBytes = idBytes
