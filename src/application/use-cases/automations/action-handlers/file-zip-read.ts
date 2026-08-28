/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { inflateRawSync } from 'node:zlib'

/**
 * Minimal, dependency-free ZIP container READER — the counterpart to the
 * STORE-only writer in `file-zip.ts`.
 *
 * ## Why this is a separate module, not an extension of `file-zip.ts`
 *
 * `file-zip.ts` is write-only and emits STORE (method 0) exclusively, because
 * the `file/compress` action controls its own output. Reading a `.xlsx` a USER
 * supplies is a different problem: the container was written by Excel,
 * LibreOffice or a library, all of which DEFLATE (method 8). A reader built and
 * exercised only against Sovrium's own STORE output would never run an inflate
 * and would fail on the first real workbook.
 *
 * ## Why `node:zlib`'s `inflateRawSync`
 *
 * Three dependency-free routes exist in this runtime — `node:zlib`
 * `inflateRawSync`, `Bun.inflateSync`, and `DecompressionStream('deflate-raw')`.
 * All three decompress correctly; `inflateRawSync` is chosen because:
 *
 *  - it is SYNCHRONOUS, so the whole `.xlsx` codec stays a pure
 *    `bytes -> data` function instead of an Effect/async pipeline threaded
 *    through the parser for no reason (`DecompressionStream` is async);
 *  - it is EXPLICITLY raw. ZIP method 8 stores a bare DEFLATE stream with no
 *    zlib header, which is exactly what `inflateRaw` expects. `Bun.inflateSync`
 *    sniffs the framing instead, and framing we already know from the ZIP
 *    header should not be re-guessed from the payload;
 *  - `node:*` builtins are established in this layer already (`crypto.ts` uses
 *    `node:crypto`, `code.ts` uses `node:vm`).
 *
 * ## Failure model
 *
 * Every unreadable container — missing end-of-central-directory record, a
 * truncated header, an unsupported compression method, corrupt DEFLATE data —
 * collapses to `undefined`. The caller turns that into a NAMED error; this
 * module never guesses at a partial archive, because a half-read `.xlsx` reads
 * downstream as "the sheet had no rows".
 */

export interface ZipReadEntry {
  readonly name: string
  readonly bytes: Uint8Array
}

const EOCD_SIGNATURE = 0x06_05_4b_50
const CENTRAL_SIGNATURE = 0x02_01_4b_50
const LOCAL_SIGNATURE = 0x04_03_4b_50

const EOCD_SIZE = 22
const CENTRAL_HEADER_SIZE = 46
const LOCAL_HEADER_SIZE = 30

/** Max ZIP comment length, per APPNOTE — the furthest back an EOCD can sit. */
const MAX_COMMENT = 0xff_ff

const METHOD_STORE = 0
const METHOD_DEFLATE = 8

/**
 * Locate the end-of-central-directory record.
 *
 * The fast path (no archive comment) puts it at exactly `length - 22`; only
 * when that misses do we scan backwards over the comment window. Scanning
 * unconditionally would allocate a 64K candidate list for every workbook.
 */
const findEocdOffset = (view: DataView, length: number): number | undefined => {
  if (length < EOCD_SIZE) return undefined
  const fast = length - EOCD_SIZE
  if (view.getUint32(fast, true) === EOCD_SIGNATURE) return fast
  const lowest = Math.max(0, fast - MAX_COMMENT)
  return Array.from({ length: fast - lowest }, (_unused, i) => fast - 1 - i).find(
    (offset) => view.getUint32(offset, true) === EOCD_SIGNATURE
  )
}

interface CentralEntry {
  readonly name: string
  readonly method: number
  readonly compressedSize: number
  readonly localHeaderOffset: number
}

/**
 * Read one central-directory header, returning it plus the offset of the next.
 * `undefined` when the signature does not match — a truncated or non-ZIP
 * directory, which fails the whole read rather than yielding a partial list.
 */
const readCentralEntry = (
  bytes: Uint8Array,
  view: DataView,
  offset: number
): { readonly entry: CentralEntry; readonly next: number } | undefined => {
  if (offset + CENTRAL_HEADER_SIZE > bytes.length) return undefined
  if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) return undefined
  const nameLength = view.getUint16(offset + 28, true)
  const extraLength = view.getUint16(offset + 30, true)
  const commentLength = view.getUint16(offset + 32, true)
  const nameStart = offset + CENTRAL_HEADER_SIZE
  if (nameStart + nameLength > bytes.length) return undefined
  return {
    entry: {
      name: new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength)),
      method: view.getUint16(offset + 10, true),
      // Sizes are read from the CENTRAL header on purpose: when the
      // data-descriptor flag (general-purpose bit 3) is set, the local header
      // carries zeros and only the central directory has the real values.
      compressedSize: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    },
    next: nameStart + nameLength + extraLength + commentLength,
  }
}

/** Walk `count` central-directory headers from `start`. */
const readCentralDirectory = (
  bytes: Uint8Array,
  view: DataView,
  start: number,
  count: number
): ReadonlyArray<CentralEntry> | undefined => {
  const walked = Array.from({ length: count }).reduce<
    { readonly entries: readonly CentralEntry[]; readonly offset: number } | undefined
  >(
    (state) => {
      if (state === undefined) return undefined
      const read = readCentralEntry(bytes, view, state.offset)
      if (read === undefined) return undefined
      return { entries: [...state.entries, read.entry], offset: read.next }
    },
    { entries: [], offset: start }
  )
  return walked?.entries
}

/** Extract and decompress one entry's payload via its local file header. */
const readEntryBytes = (
  bytes: Uint8Array,
  view: DataView,
  entry: CentralEntry
): Uint8Array | undefined => {
  const offset = entry.localHeaderOffset
  if (offset + LOCAL_HEADER_SIZE > bytes.length) return undefined
  if (view.getUint32(offset, true) !== LOCAL_SIGNATURE) return undefined
  const nameLength = view.getUint16(offset + 26, true)
  const extraLength = view.getUint16(offset + 28, true)
  const start = offset + LOCAL_HEADER_SIZE + nameLength + extraLength
  const end = start + entry.compressedSize
  if (end > bytes.length) return undefined
  const payload = bytes.subarray(start, end)
  if (entry.method === METHOD_STORE) return payload
  if (entry.method !== METHOD_DEFLATE) return undefined
  try {
    return new Uint8Array(inflateRawSync(payload))
  } catch {
    return undefined
  }
}

/**
 * Read every entry of a ZIP container, or `undefined` when the bytes are not a
 * readable archive.
 */
export const readZipEntries = (bytes: Uint8Array): ReadonlyArray<ZipReadEntry> | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEocdOffset(view, bytes.length)
  if (eocd === undefined) return undefined

  const count = view.getUint16(eocd + 10, true)
  const centralOffset = view.getUint32(eocd + 16, true)
  const central = readCentralDirectory(bytes, view, centralOffset, count)
  if (central === undefined) return undefined

  const entries = central.map((entry) => {
    const payload = readEntryBytes(bytes, view, entry)
    return payload === undefined ? undefined : { name: entry.name, bytes: payload }
  })
  return entries.every((e): e is ZipReadEntry => e !== undefined) ? entries : undefined
}
