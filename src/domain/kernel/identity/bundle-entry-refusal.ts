/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which entry of an imported bundle must never land on disk.
 *
 * `sovrium init --from-bundle` unpacks an archive somebody else wrote into a
 * folder a person then edits, so every entry is judged by its tar HEADER, not
 * only by its name: an archive reader that lists regular files alone (as
 * `Bun.Archive#files` does) silently hides a symlink, which is why the header
 * is the input here.
 *
 * Refused, each by path: a path an extractor could follow out of the target
 * (absolute, a `..`, `.` or empty segment, a backslash, a NUL); an entry that
 * is not a regular file; TypeScript anywhere (`.ts`, `.tsx`, `.mts`, `.cts`),
 * because running a program fetched from a link is a different product; and
 * an executable, by mode bit or by its first bytes (ELF, Mach-O, PE, `#!`).
 * `public/*.js` is content a browser runs and the engine never does, so it is
 * allowed. Two entries that differ only by letter case are refused together,
 * since the target may be a case-insensitive filesystem.
 *
 * A directory entry is allowed and carries no file: its path is judged like
 * any other, and nothing else of it is (a directory's `0o755` is a traversal
 * bit, not an execute bit). The writer creates the directories its files need.
 */

/** The kind of a tar entry, read from its typeflag. */
export type BundleEntryType =
  'file' | 'directory' | 'symlink' | 'hardlink' | 'char-device' | 'block-device' | 'fifo' | 'other'

/** What a tar header says about one entry, plus the first bytes of its body. */
export interface BundleEntryHeader {
  readonly path: string
  readonly type: BundleEntryType
  /** The permission bits the archive records, e.g. `0o644`. */
  readonly mode: number
  /** At least the first four bytes of the body, for the native-executable check. */
  readonly head: Uint8Array
}

/** Why an entry is refused: the rule it broke, and its path as the archive spells it. */
export interface BundleEntryRefusal {
  readonly path: string
  readonly rule: 'unsafe-path' | 'not-a-regular-file' | 'typescript' | 'executable'
}

/** Native executables and interpreter lines, by their first bytes. */
const EXECUTABLE_MAGIC: readonly (readonly number[])[] = [
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0xfe, 0xed, 0xfa, 0xce], // Mach-O 32-bit
  [0xfe, 0xed, 0xfa, 0xcf], // Mach-O 64-bit
  [0xce, 0xfa, 0xed, 0xfe], // Mach-O 32-bit, little-endian
  [0xcf, 0xfa, 0xed, 0xfe], // Mach-O 64-bit, little-endian
  [0xca, 0xfe, 0xba, 0xbe], // Mach-O universal
  [0x4d, 0x5a], // PE (`MZ`)
  [0x23, 0x21], // `#!`
]

const TYPESCRIPT = /\.(?:ts|tsx|mts|cts)$/i

/** Any execute bit, for the owner, the group or anyone. */
const EXECUTE_BITS = 0o111

/** A path an extractor could follow out of the directory it unpacks into. */
const isUnsafePath = (path: string): boolean =>
  path === '' ||
  path.startsWith('/') ||
  /^[A-Za-z]:/.test(path) ||
  path.includes('\\') ||
  path.includes('\0') ||
  path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')

const startsWith = (head: Uint8Array, magic: readonly number[]): boolean =>
  head.byteLength >= magic.length && magic.every((byte, index) => head[index] === byte)

const isExecutable = (entry: BundleEntryHeader): boolean =>
  (entry.mode & EXECUTE_BITS) !== 0 ||
  EXECUTABLE_MAGIC.some((magic) => startsWith(entry.head, magic))

const ruleBroken = (entry: BundleEntryHeader): BundleEntryRefusal['rule'] | undefined => {
  if (isUnsafePath(entry.path)) return 'unsafe-path'
  if (entry.type === 'directory') return undefined
  if (entry.type !== 'file') return 'not-a-regular-file'
  if (TYPESCRIPT.test(entry.path)) return 'typescript'
  return isExecutable(entry) ? 'executable' : undefined
}

/** The refusal an entry earns, or `undefined` when it may be written. */
export const bundleEntryRefusal = (entry: BundleEntryHeader): BundleEntryRefusal | undefined => {
  const rule = ruleBroken(entry)
  return rule === undefined ? undefined : { path: entry.path, rule }
}

/** Every pair of paths that differ only by letter case, in archive order. */
export const caseCollisions = (paths: readonly string[]): readonly (readonly [string, string])[] =>
  paths.flatMap((path, index) => {
    const folded = path.toLowerCase()
    const earlier = paths.slice(0, index).find((other) => other.toLowerCase() === folded)
    return earlier === undefined || earlier === path ? [] : [[earlier, path] as const]
  })

/** The mode an imported file is written with: never an execute, setuid, setgid or sticky bit. */
export const writtenFileMode = (archiveMode: number): number => archiveMode & 0o666
