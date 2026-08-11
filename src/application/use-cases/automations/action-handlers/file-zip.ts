/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Minimal, dependency-free ZIP container writer (STORE method — no
 * compression). Used by the `file/compress` action handler.
 *
 * The automation `compress` action only needs to produce a *valid* ZIP
 * archive (correct PK magic, listable entries) — the test corpus uses tiny
 * text payloads where DEFLATE would add overhead, not save it. A self-
 * contained STORE writer keeps the handler free of a third-party archiver
 * dependency while still emitting a spec-compliant `.zip`.
 *
 * Layout: a sequence of local-file headers + raw data, followed by a
 * central directory and an end-of-central-directory record, exactly per
 * the PKZIP APPNOTE for the STORE (method 0) case.
 */

export interface ZipEntry {
  readonly name: string
  readonly bytes: Uint8Array
}

/**
 * Build a single CRC-32 table entry by 8-fold polynomial reduction.
 * Hoisted to module scope so it isn't reallocated on every `crc32` call.
 */
const crc32TableReduce = (c: number): number =>
  Array.from({ length: 8 }).reduce<number>(
    (acc) => (acc & 1 ? 0xed_b8_83_20 ^ (acc >>> 1) : acc >>> 1),
    c
  )

/**
 * Precomputed CRC-32 lookup table. Built once at module load — the table is
 * a pure function of the IEEE 802.3 polynomial, so memoizing at module scope
 * is cheaper than rebuilding it on every `crc32` invocation.
 */
const CRC32_TABLE: ReadonlyArray<number> = Array.from({ length: 256 }, (_unused, n) =>
  crc32TableReduce(n)
)

/** CRC-32 (IEEE 802.3) — required in every ZIP local + central header. */
const crc32 = (bytes: Uint8Array): number => {
  const crc = bytes.reduce<number>(
    (acc, byte) => (acc >>> 8) ^ (CRC32_TABLE[(acc ^ byte) & 0xff] as number),
    0xff_ff_ff_ff
  )
  return (crc ^ 0xff_ff_ff_ff) >>> 0
}

const writeU16 = (view: DataView, offset: number, value: number): void =>
  view.setUint16(offset, value & 0xff_ff, true)

const writeU32 = (view: DataView, offset: number, value: number): void =>
  view.setUint32(offset, value >>> 0, true)

interface PreparedEntry {
  readonly nameBytes: Uint8Array
  readonly data: Uint8Array
  readonly crc: number
  readonly localHeaderOffset: number
}

const LOCAL_HEADER_SIZE = 30
const CENTRAL_HEADER_SIZE = 46
const EOCD_SIZE = 22

const localHeaderFor = (entry: PreparedEntry): Uint8Array => {
  const header = new Uint8Array(LOCAL_HEADER_SIZE + entry.nameBytes.length)
  const view = new DataView(header.buffer)
  writeU32(view, 0, 0x04_03_4b_50) // local file header signature "PK\x03\x04"
  writeU16(view, 4, 20) // version needed to extract
  writeU16(view, 6, 0) // general purpose bit flag
  writeU16(view, 8, 0) // compression method: STORE
  writeU16(view, 10, 0) // mod time
  writeU16(view, 12, 0) // mod date
  writeU32(view, 14, entry.crc)
  writeU32(view, 18, entry.data.length) // compressed size
  writeU32(view, 22, entry.data.length) // uncompressed size
  writeU16(view, 26, entry.nameBytes.length)
  writeU16(view, 28, 0) // extra field length
  header.set(entry.nameBytes, LOCAL_HEADER_SIZE)
  return header
}

/**
 * Layout of the ZIP central-directory header (one entry per file in the archive).
 * Each pair is `[byteOffset, value]`; absent offsets (zero-filled) are implicit
 * since `new Uint8Array(...)` initializes to zero.
 */
const buildCentralHeaderWrites = (entry: PreparedEntry): ReadonlyArray<[number, number, 16 | 32]> =>
  [
    [0, 0x02_01_4b_50, 32], // central directory header signature "PK\x01\x02"
    [4, 20, 16], // version made by
    [6, 20, 16], // version needed
    [16, entry.crc, 32],
    [20, entry.data.length, 32],
    [24, entry.data.length, 32],
    [28, entry.nameBytes.length, 16],
    [42, entry.localHeaderOffset, 32],
  ] as const

const centralHeaderFor = (entry: PreparedEntry): Uint8Array => {
  const header = new Uint8Array(CENTRAL_HEADER_SIZE + entry.nameBytes.length)
  const view = new DataView(header.buffer)
  buildCentralHeaderWrites(entry).forEach(([offset, value, width]) =>
    width === 16 ? writeU16(view, offset, value) : writeU32(view, offset, value)
  )
  header.set(entry.nameBytes, CENTRAL_HEADER_SIZE)
  return header
}

const eocdFor = (count: number, centralSize: number, centralOffset: number): Uint8Array => {
  const eocd = new Uint8Array(EOCD_SIZE)
  const view = new DataView(eocd.buffer)
  writeU32(view, 0, 0x06_05_4b_50) // end of central dir signature "PK\x05\x06"
  writeU16(view, 4, 0) // number of this disk
  writeU16(view, 6, 0) // disk with central directory
  writeU16(view, 8, count) // entries on this disk
  writeU16(view, 10, count) // total entries
  writeU32(view, 12, centralSize)
  writeU32(view, 16, centralOffset)
  writeU16(view, 20, 0) // comment length
  return eocd
}

/**
 * Concatenate a sequence of `Uint8Array` chunks into a single buffer.
 *
 * `Uint8Array` cannot be built from an immutable spread without quadratic
 * copying, so we allocate a single fixed-size output and thread the write
 * offset through `reduce`. The local `out` is the only buffer the caller
 * ever sees — externally observable as a pure (input → output) function.
 *
 * The `.set` / `.reduce` calls inside trip `functional/immutable-data` and
 * `functional/no-expression-statements`; these are unavoidable for
 * in-place TypedArray assembly and the rule is disabled at the statement
 * level rather than refactored away.
 */
const concat = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  // eslint-disable-next-line functional/no-expression-statements -- See above: in-place Uint8Array assembly; `out` is buffer-local.
  chunks.reduce((offset, chunk) => {
    out.set(chunk, offset)
    return offset + chunk.length
  }, 0)
  return out
}

/**
 * Build an uncompressed (STORE) ZIP archive from the supplied entries.
 * The result begins with the `PK\x03\x04` local-file-header magic.
 */
export const buildStoredZip = (entries: ReadonlyArray<ZipEntry>): Uint8Array => {
  const encoder = new TextEncoder()
  const prepared = entries.reduce<{ items: PreparedEntry[]; offset: number }>(
    (state, entry) => {
      const nameBytes = encoder.encode(entry.name)
      const item: PreparedEntry = {
        nameBytes,
        data: entry.bytes,
        crc: crc32(entry.bytes),
        localHeaderOffset: state.offset,
      }
      const localSize = LOCAL_HEADER_SIZE + nameBytes.length + entry.bytes.length
      return { items: [...state.items, item], offset: state.offset + localSize }
    },
    { items: [], offset: 0 }
  )

  const localSection = prepared.items.flatMap((entry) => [localHeaderFor(entry), entry.data])
  const centralSection = prepared.items.map((entry) => centralHeaderFor(entry))
  const centralSize = centralSection.reduce((sum, c) => sum + c.length, 0)
  const eocd = eocdFor(prepared.items.length, centralSize, prepared.offset)

  return concat([...localSection, ...centralSection, eocd])
}
