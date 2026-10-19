/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  concatBytes,
  ensureCount,
  latin1,
  latin1Bytes,
  malformed,
  MAX_LIST_ENTRIES,
  u32,
  u64,
  uintBytes,
} from './media-bytes'

/**
 * The ISO base media file format's box tree (ISO/IEC 14496-12): MP4, M4A,
 * QuickTime `.mov` and fragmented MP4 all share it. A box is a 32-bit size, a
 * four-character type, then its payload; a size of 1 means a 64-bit size
 * follows the type, and a size of 0 means "to the end of the enclosing range".
 */

export interface Box {
  readonly type: string
  /** The offset of the box's first header byte. */
  readonly start: number
  /** The offset of its payload's first byte. */
  readonly payload: number
  /** The offset one past its last byte. */
  readonly end: number
}

/**
 * The boxes laid end to end in `bytes[from, to)`. A box overrunning its range
 * is malformed, and so is a list past {@link MAX_LIST_ENTRIES} boxes.
 */
export const boxesIn = (bytes: Uint8Array, from: number, to: number): readonly Box[] => {
  const boxes: Box[] = []
  let at = from
  while (at + 8 <= to) {
    const small = u32(bytes, at)
    const type = latin1(bytes, at + 4, 4)
    const header = small === 1 ? 16 : 8
    const size = small === 1 ? u64(bytes, at + 8) : small === 0 ? to - at : small
    if (size < header || at + size > to)
      malformed(`the "${type}" box at byte ${String(at)} overruns its container`)
    ensureCount(boxes.length + 1, MAX_LIST_ENTRIES, 'boxes side by side')
    // eslint-disable-next-line no-restricted-syntax -- sanctioned mutation: appending each box to one array keeps a parse linear
    boxes.push({ type, start: at, payload: at + header, end: at + size })
    at += size
  }
  return boxes
}

/** The children of `parent`, starting `skip` bytes into its payload (a full box's version and flags, a sample entry's fields). */
export const childrenOf = (bytes: Uint8Array, parent: Box, skip = 0): readonly Box[] =>
  boxesIn(bytes, parent.payload + skip, parent.end)

/** The first child of `parent` of `type`. */
export const childBox = (
  bytes: Uint8Array,
  parent: Box | undefined,
  type: string
): Box | undefined =>
  parent === undefined ? undefined : childrenOf(bytes, parent).find((box) => box.type === type)

/** The box at the end of `path` under `parent`, each step its first child of that type. */
export const descend = (
  bytes: Uint8Array,
  parent: Box | undefined,
  path: readonly string[]
): Box | undefined =>
  path.reduce<Box | undefined>((box, type) => childBox(bytes, box, type), parent)

/** A full box's version byte. */
export const versionOf = (bytes: Uint8Array, box: Box): number =>
  bytes[box.payload] ?? malformed('an empty full box')

/** The bytes of `box`, header included, as they were stored. */
export const boxBytes = (bytes: Uint8Array, box: Box): Uint8Array =>
  bytes.subarray(box.start, box.end)

/** A box of `type` around `parts`, with a 64-bit size only when a 32-bit one cannot hold it. */
export const writeBox = (type: string, parts: readonly Uint8Array[]): Uint8Array => {
  const payload = parts.reduce((total, part) => total + part.length, 0)
  const large = payload + 8 > 0xff_ff_ff_ff
  const header = large
    ? [uintBytes(1, 4), latin1Bytes(type), uintBytes(payload + 16, 8)]
    : [uintBytes(payload + 8, 4), latin1Bytes(type)]
  return concatBytes([...header, ...parts])
}

/** A full box: version, 24-bit flags, then `parts`. */
export const writeFullBox = (
  type: string,
  version: number,
  flags: number,
  parts: readonly Uint8Array[]
): Uint8Array => writeBox(type, [uintBytes(version, 1), uintBytes(flags, 3), ...parts])
