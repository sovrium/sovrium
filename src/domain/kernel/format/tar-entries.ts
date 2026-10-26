/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every entry of an (already inflated) tar, read from its raw HEADERS.
 *
 * `Bun.Archive#files()` lists regular files only: a symlink, a hard link, a
 * device or a FIFO is silently absent from what it returns, so a reader that
 * judges an archive by that list cannot refuse what it never sees. This reader
 * returns every entry with its typeflag and mode, and leaves the judging to
 * the caller.
 *
 * It reads ustar (with its `prefix` field), the pax extended header `x` (its
 * `path` and `size` records) and the GNU long name `L`, which are the three
 * ways a tar writer spells a path over 100 bytes. A pax global header `g` and
 * a GNU long link `K` carry nothing an entry needs and are skipped. A header
 * whose checksum does not add up, or a body cut short, makes the whole archive
 * unreadable: `undefined`, never a partial list.
 */

/** The kind of a tar entry, read from its typeflag. */
export type TarEntryType =
  'file' | 'directory' | 'symlink' | 'hardlink' | 'char-device' | 'block-device' | 'fifo' | 'other'

/** One entry: its path as the archive spells it, its kind, its mode bits and its body. */
export interface TarEntry {
  readonly path: string
  readonly type: TarEntryType
  readonly mode: number
  readonly bytes: Uint8Array
}

const BLOCK = 512

const TYPEFLAGS: Readonly<Record<string, TarEntryType>> = {
  '0': 'file',
  '': 'file',
  '7': 'file',
  '1': 'hardlink',
  '2': 'symlink',
  '3': 'char-device',
  '4': 'block-device',
  '5': 'directory',
  '6': 'fifo',
}

/** Header-only records that describe the NEXT entry, or nothing at all. */
const META_TYPEFLAGS: ReadonlySet<string> = new Set(['x', 'g', 'L', 'K'])

const decoder = new TextDecoder()

/** A NUL-terminated text field. */
const text = (header: Uint8Array, offset: number, length: number): string => {
  const field = header.subarray(offset, offset + length)
  const end = field.indexOf(0)
  return decoder.decode(end === -1 ? field : field.subarray(0, end))
}

/** A numeric field: octal text, or base-256 when its first byte has the high bit set. */
const numeric = (header: Uint8Array, offset: number, length: number): number | undefined => {
  const field = header.subarray(offset, offset + length)
  if (((field[0] ?? 0) & 0x80) !== 0) {
    return field.subarray(1).reduce((value, byte) => value * 256 + byte, (field[0] ?? 0) & 0x7f)
  }
  const digits = text(header, offset, length).trim()
  if (digits === '') return 0
  return /^[0-7]+$/.test(digits) ? Number.parseInt(digits, 8) : undefined
}

/** Whether the header's stored checksum is the sum of its bytes, the checksum field read as spaces. */
const checksumHolds = (header: Uint8Array): boolean => {
  const stored = numeric(header, 148, 8)
  const sum = header.reduce(
    (total, byte, index) => total + (index >= 148 && index < 156 ? 0x20 : byte),
    0
  )
  return stored === sum
}

/** The `key=value` records of a pax extended header body. */
const paxRecords = (body: Uint8Array): Readonly<Record<string, string>> =>
  Object.fromEntries(
    decoder
      .decode(body)
      .split('\n')
      .map((line) => line.replace(/^\d+ /, ''))
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
  )

/** What a pax or GNU header said about the entry that follows it. */
interface Pending {
  readonly path?: string
  readonly size?: number
}

/** The path a ustar header names, its `prefix` joined in front when present. */
const headerPath = (header: Uint8Array): string => {
  const name = text(header, 0, 100)
  const isUstar = text(header, 257, 6).startsWith('ustar')
  const prefix = isUstar ? text(header, 345, 155) : ''
  return prefix === '' ? name : `${prefix}/${name}`
}

/** A directory's trailing slash is part of how tar spells it, not part of its path. */
const entryPath = (path: string, type: TarEntryType): string =>
  type === 'directory' ? path.replace(/\/+$/, '') : path

/** The pending state a meta record leaves for the next entry. */
const pendingAfter = (flag: string, body: Uint8Array, pending: Pending): Pending => {
  if (flag === 'L') return { ...pending, path: text(body, 0, body.byteLength) }
  if (flag !== 'x') return pending
  const records = paxRecords(body)
  const size = records['size'] === undefined ? undefined : Number(records['size'])
  return {
    ...pending,
    ...(records['path'] === undefined ? {} : { path: records['path'] }),
    ...(size === undefined || !Number.isSafeInteger(size) ? {} : { size }),
  }
}

/** A header's size and mode, `undefined` when a numeric field does not read or the checksum fails. */
const headerNumbers = (
  header: Uint8Array
): { readonly size: number; readonly mode: number } | undefined => {
  if (!checksumHolds(header)) return undefined
  const size = numeric(header, 124, 12)
  const mode = numeric(header, 100, 8)
  return size === undefined || mode === undefined ? undefined : { size, mode }
}

/** Read entries from `offset` on, recursively (a tail call), so no list is mutated. */
const readFrom = (
  tar: Uint8Array,
  offset: number,
  pending: Pending,
  read: readonly TarEntry[]
): readonly TarEntry[] | undefined => {
  const header = tar.subarray(offset, offset + BLOCK)
  if (header.byteLength < BLOCK || header.every((byte) => byte === 0)) return read
  const numbers = headerNumbers(header)
  if (numbers === undefined) return undefined
  const flag = text(header, 156, 1)
  const size = pending.size ?? numbers.size
  const start = offset + BLOCK
  if (start + size > tar.byteLength) return undefined
  const body = tar.subarray(start, start + size)
  const next = start + Math.ceil(size / BLOCK) * BLOCK
  if (META_TYPEFLAGS.has(flag)) return readFrom(tar, next, pendingAfter(flag, body, pending), read)
  const type = TYPEFLAGS[flag] ?? 'other'
  const path = entryPath(pending.path ?? headerPath(header), type)
  const entry = { path, type, mode: numbers.mode & 0o7777, bytes: body }
  return readFrom(tar, next, {}, [...read, entry])
}

/** Every entry of `tar`, in archive order, or `undefined` when the bytes are not a readable tar. */
export const readTarEntries = (tar: Uint8Array): readonly TarEntry[] | undefined =>
  tar.byteLength < BLOCK ? undefined : readFrom(tar, 0, {}, [])
