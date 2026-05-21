/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface ZipEntry {
  readonly name: string
  readonly bytes: Uint8Array
}

const crc32TableReduce = (c: number): number =>
  Array.from({ length: 8 }).reduce<number>(
    (acc) => (acc & 1 ? 0xed_b8_83_20 ^ (acc >>> 1) : acc >>> 1),
    c
  )

const CRC32_TABLE: ReadonlyArray<number> = Array.from({ length: 256 }, (_unused, n) =>
  crc32TableReduce(n)
)

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
  writeU32(view, 0, 0x04_03_4b_50)
  writeU16(view, 4, 20)
  writeU16(view, 6, 0)
  writeU16(view, 8, 0)
  writeU16(view, 10, 0)
  writeU16(view, 12, 0)
  writeU32(view, 14, entry.crc)
  writeU32(view, 18, entry.data.length)
  writeU32(view, 22, entry.data.length)
  writeU16(view, 26, entry.nameBytes.length)
  writeU16(view, 28, 0)
  header.set(entry.nameBytes, LOCAL_HEADER_SIZE)
  return header
}

const buildCentralHeaderWrites = (entry: PreparedEntry): ReadonlyArray<[number, number, 16 | 32]> =>
  [
    [0, 0x02_01_4b_50, 32],
    [4, 20, 16],
    [6, 20, 16],
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
  writeU32(view, 0, 0x06_05_4b_50)
  writeU16(view, 4, 0)
  writeU16(view, 6, 0)
  writeU16(view, 8, count)
  writeU16(view, 10, count)
  writeU32(view, 12, centralSize)
  writeU32(view, 16, centralOffset)
  writeU16(view, 20, 0)
  return eocd
}

const concat = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  chunks.reduce((offset, chunk) => {
    out.set(chunk, offset)
    return offset + chunk.length
  }, 0)
  return out
}

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
