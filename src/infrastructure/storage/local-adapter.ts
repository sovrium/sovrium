/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constants } from 'node:fs'
import { access, lstat, mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import {
  compareStorageKeys,
  isCanonicalStorageKey,
  isStagingName,
} from '@/domain/kernel/identity/storage-key'
import { listFilesBelow } from '@/infrastructure/filesystem/list-files-below'
import { hashStream, readStreamWithin } from './bounded-read'
import type { StoredObjectHash } from '@/application/ports/services/storage-service'

/**
 * Validate that a local storage directory exists and is writable.
 * Attempts to create the directory if it doesn't exist, then verifies
 * write access using fs.access with W_OK flag.
 * Naturally rejects if the directory cannot be created or accessed.
 */
export const localValidateDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true })
  await access(directory, constants.W_OK)
}

/**
 * Resolve a path under the storage directory and verify it stays inside it.
 * Prevents path traversal attacks (e.g., key = "../../etc/passwd").
 */
const resolveConfinedPath = (directory: string, key: string): string => {
  const base = resolve(directory)
  const target = resolve(directory, key)
  if (!target.startsWith(base + sep) && target !== base) {
    throw new Error(`Path traversal detected: key "${key}" escapes storage directory`)
  }
  return target
}

/** On a Windows disk a key is also held to the spellings Windows would alias. */
const HOST_KEY_PLATFORM = { windows: process.platform === 'win32' } as const

/**
 * Resolve the file an object key names — exactly one file, inside the storage
 * directory, reachable by no other spelling.
 *
 * Confinement alone is not enough. Ownership is recorded against the literal
 * key, so a key the filesystem normalises (`victim.png/`, `x/../victim.png`,
 * `a//b`) passes every catalog check as an unknown key and then writes to the
 * file another key owns. Refusing every non-canonical key, and re-checking that
 * the resolved path maps back onto the key verbatim, keeps the key-to-file
 * mapping one-to-one for every caller, whatever door the key came through. On
 * Windows that includes `a:b` (a stream of `a`) and a trailing `.` or space.
 */
export const resolveStoragePath = (directory: string, key: string): string => {
  const refuse = (): never => {
    throw new Error(`Path traversal detected: key "${key}" does not name exactly one stored file`)
  }
  if (!isCanonicalStorageKey(key, HOST_KEY_PLATFORM)) return refuse()
  const target = resolveConfinedPath(directory, key)
  return relative(resolve(directory), target).split(sep).join('/') === key ? target : refuse()
}

export const localUpload = async (
  directory: string,
  key: string,
  content: Uint8Array
): Promise<void> => {
  const filePath = resolveStoragePath(directory, key)
  await mkdir(dirname(filePath), { recursive: true })
  await Bun.write(filePath, content)
}

/** Remove a file that may not be there: absent is what was asked for. */
const unlinkIfPresent = async (path: string): Promise<void> => {
  try {
    await unlink(path)
  } catch (error) {
    if ((error as { readonly code?: unknown }).code !== 'ENOENT') throw error
  }
}

/**
 * {@link localUpload} in two steps: the bytes are written to a file of their
 * own beside the key, under a fresh name, and reach the key only on `commit`,
 * which renames that file into place in one step; `discard` removes it. A
 * write that fails part-way removes what it wrote.
 */
export const localStageWrite = async (
  directory: string,
  key: string,
  content: Uint8Array
): Promise<{ readonly commit: () => Promise<void>; readonly discard: () => Promise<void> }> => {
  const filePath = resolveStoragePath(directory, key)
  await mkdir(dirname(filePath), { recursive: true })
  const stagedPath = join(dirname(filePath), `.sovrium-staging-${crypto.randomUUID()}`)
  try {
    await writeFile(stagedPath, content, { flag: 'wx' })
  } catch (error) {
    await unlinkIfPresent(stagedPath)
    throw error
  }
  return {
    commit: () => rename(stagedPath, filePath),
    discard: () => unlinkIfPresent(stagedPath),
  }
}

/**
 * {@link localUpload} that replaces nothing: the file is created exclusively
 * (`wx`), so `taken` comes back when anything is already stored at `key`,
 * and what is there is left as it was.
 */
export const localUploadCreateOnly = async (
  directory: string,
  key: string,
  content: Uint8Array
): Promise<'written' | 'taken'> => {
  const filePath = resolveStoragePath(directory, key)
  await mkdir(dirname(filePath), { recursive: true })
  try {
    await writeFile(filePath, content, { flag: 'wx' })
    return 'written'
  } catch (error) {
    if ((error as { readonly code?: unknown }).code === 'EEXIST') return 'taken'
    throw error
  }
}

/**
 * The bytes of the file stored under `key`, read at most `maxBytes`: `undefined`
 * once the file passes the cap, read piece by piece so a larger file is never
 * buffered whole. Rejects for a file that is not there. The only read of a
 * stored file's bytes: there is no unbounded one.
 */
export const localDownloadWithin = async (
  directory: string,
  key: string,
  maxBytes: number
): Promise<Uint8Array | undefined> =>
  readStreamWithin(Bun.file(resolveStoragePath(directory, key)).stream(), maxBytes)

/**
 * The length and SHA-256 of the file stored under `key`, hashed while it is
 * read as a stream. Rejects as a download does for a file that is not there.
 */
export const localHashObject = async (directory: string, key: string): Promise<StoredObjectHash> =>
  hashStream(Bun.file(resolveStoragePath(directory, key)).stream())

/**
 * The size of the file stored under `key`, read from the disk itself; `undefined`
 * when no regular file is there. Needs no catalog row, so it sizes a file
 * another process wrote into the storage directory.
 */
export const localStoredSize = async (
  directory: string,
  key: string
): Promise<number | undefined> => {
  try {
    const stats = await stat(resolveStoragePath(directory, key))
    return stats.isFile() ? stats.size : undefined
  } catch (error) {
    if ((error as { readonly code?: unknown }).code === 'ENOENT') return undefined
    throw error
  }
}

export const localDelete = async (directory: string, key: string): Promise<void> => {
  const filePath = resolveStoragePath(directory, key)
  await unlink(filePath)
}

/**
 * {@link localDelete} for a caller that only needs the file GONE — erasure
 * removing the bytes of an object whose catalog row it already deleted. A file
 * that is not there is the outcome asked for, not a failure; any other error
 * (permissions, an unreadable disk) still rejects.
 */
export const localDeleteIfPresent = async (directory: string, key: string): Promise<void> => {
  try {
    await localDelete(directory, key)
  } catch (error) {
    if ((error as { readonly code?: unknown }).code !== 'ENOENT') throw error
  }
}

/**
 * Where a listing under `prefix` starts reading: the folder its last `/` ends
 * (`projects/` for `projects/20`, the root for `20`), and that folder's key
 * base. A prefix is a plain string prefix, as on an object store: the keys
 * under the folder are kept when they start with it, so `projects/20` lists
 * `projects/2026/brief.txt`.
 */
const listingFolder = (
  directory: string,
  prefix: string
): { readonly path: string; readonly keyBase: string } => {
  const keyBase = prefix.slice(0, prefix.lastIndexOf('/') + 1)
  return {
    keyBase,
    path: keyBase === '' ? directory : resolveConfinedPath(directory, keyBase.slice(0, -1)),
  }
}

/** A listing root that is not there, or not a directory, lists nothing; any other failure is a failure. */
const isAbsentDirectory = (error: unknown): boolean => {
  const { code } = error as { readonly code?: unknown }
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/**
 * Whether the folder `keyBase` names is reached through a symbolic link: a
 * listing walks into no link, so neither does the folder it starts from. A
 * segment that is not there answers `false`; the listing then finds nothing.
 */
const folderCrossesLink = async (directory: string, keyBase: string): Promise<boolean> => {
  const segments = keyBase.split('/').filter((segment) => segment !== '')
  const paths = segments.map((_, index) => join(directory, ...segments.slice(0, index + 1)))
  const links = await Promise.all(
    paths.map((path) =>
      lstat(path).then(
        (stats) => stats.isSymbolicLink(),
        (error: unknown) => {
          if (isAbsentDirectory(error)) return false
          throw error
        }
      )
    )
  )
  return links.includes(true)
}

/** Whether a path below the storage directory names bytes staged for a write, not a stored object. */
export const isStagedPath = (path: string): boolean =>
  isStagingName(path.slice(path.lastIndexOf('/') + 1))

/**
 * The keys of the FILES under `prefix`, in UTF-8 byte order (the order an
 * object store lists in), each the key it was stored at. A directory is never
 * a key — an object store has no folder object — and a symbolic link, to a
 * file or to a directory, is neither listed nor entered ({@link listFilesBelow}),
 * so nothing outside the storage directory is ever listed, and nothing a
 * caller deletes from this listing can sit outside it.
 */
export const localList = async (directory: string, prefix: string): Promise<readonly string[]> => {
  const folder = listingFolder(directory, prefix)
  if (await folderCrossesLink(directory, folder.keyBase)) return []
  try {
    return (await listFilesBelow(folder.path))
      .filter((path) => !isStagedPath(path))
      .map((path) => folder.keyBase + path)
      .filter((key) => key.startsWith(prefix))
      .toSorted(compareStorageKeys)
  } catch (error) {
    if (isAbsentDirectory(error)) return []
    throw error
  }
}

/** One directory entry as the paged walk reads it. */
export interface LocalListedEntry {
  readonly name: string
  readonly isDirectory: () => boolean
  readonly isSymbolicLink: () => boolean
}

/** How the paged walk reads one directory: the seam a test counts. */
export type LocalReadDir = (path: string) => Promise<readonly LocalListedEntry[]>

const readDirEntries: LocalReadDir = (path) => readdir(path, { withFileTypes: true })

/**
 * Walk one directory in key order (UTF-8 byte order), appending to `out` the
 * keys under `prefix` after `after` until it holds `limit`. Only files are
 * keys, as in {@link localList}: a directory is not listed, its subtree is
 * visited at `name + '/'`, the place its keys take in that order (`a-c`
 * before `a/b`), and a symbolic link is skipped without being listed or
 * entered. A subtree whose every key sorts at or before `after` is skipped
 * without being read.
 */
const walkInKeyOrder = async (
  path: string,
  keyBase: string,
  page: {
    readonly prefix: string
    readonly after: string | undefined
    readonly limit: number
    readonly out: string[]
  },
  readDir: LocalReadDir
): Promise<void> => {
  const { prefix, after, limit, out } = page
  const items = (await readDir(path))
    .filter((entry) => !entry.isSymbolicLink())
    .filter((entry) => entry.isDirectory() || !isStagingName(entry.name))
    .map((entry) =>
      entry.isDirectory()
        ? { key: `${keyBase}${entry.name}/`, path: join(path, entry.name) }
        : { key: keyBase + entry.name, path: undefined }
    )
    // A folder's key ends in `/`, so `projects/2026/` is kept for `projects/20`.
    .filter((item) => item.key.startsWith(prefix))
    .toSorted((a, b) => compareStorageKeys(a.key, b.key))
  for (const item of items) {
    if (out.length >= limit) return
    if (item.path === undefined) {
      // One array, each key appended in place: the page stays linear.
      // eslint-disable-next-line no-restricted-syntax -- sanctioned mutation: see above
      if (after === undefined || compareStorageKeys(item.key, after) > 0) out.push(item.key)
      continue
    }
    // Every key below starts with `item.key`: it all sorts before `after` when
    // `after` is greater and does not itself fall inside the subtree.
    const wholeSubtreeBefore =
      after !== undefined && compareStorageKeys(after, item.key) > 0 && !after.startsWith(item.key)
    if (!wholeSubtreeBefore) await walkInKeyOrder(item.path, item.key, page, readDir)
  }
}

/**
 * One page of {@link localList}, in its order, after `after`: at most `size`
 * keys. A directory has no listing cursor of its own, so each page walks the
 * tree in key order, skipping every subtree that sorts wholly at or before
 * `after`, and stops once it has found one key past the page: a listing read to
 * its end reads each directory a bounded number of times.
 */
export const localListPage = async (
  directory: string,
  input: { readonly prefix: string; readonly after: string | undefined; readonly size: number },
  readDir: LocalReadDir = readDirEntries
): Promise<{ readonly keys: readonly string[]; readonly after: string | undefined }> => {
  const { prefix, after, size } = input
  const folder = listingFolder(directory, prefix)
  if (await folderCrossesLink(directory, folder.keyBase)) return { keys: [], after: undefined }
  const found: string[] = []
  try {
    await walkInKeyOrder(
      folder.path,
      folder.keyBase,
      { prefix, after, limit: size + 1, out: found },
      readDir
    )
  } catch (error) {
    // As {@link localList}: a prefix whose folder is not there lists nothing.
    if (isAbsentDirectory(error)) return { keys: [], after: undefined }
    throw error
  }
  const keys = found.slice(0, size)
  return { keys, after: found.length > size ? keys.at(-1) : undefined }
}

/**
 * Sum the sizes of the files under `directory`, for `STORAGE_MAX_TOTAL_SIZE`
 * quota enforcement on the local-filesystem provider. A file reached through
 * a symbolic link is not counted ({@link listFilesBelow}), so a link cycle can
 * neither fail the walk nor zero the total. 0 when the directory does not
 * exist; any other failure rejects, so a total that could not be read is
 * never reported as an empty store.
 */
export const localGetTotalBytes = async (directory: string): Promise<number> => {
  const files = await listFilesBelow(directory).catch((error: unknown) => {
    if (isAbsentDirectory(error)) return []
    throw error
  })
  // Bytes staged for a write in progress are no stored object's.
  const stored = files.filter((path) => !isStagedPath(path))
  const sizes = await Promise.all(
    stored.map(async (path) => {
      try {
        return (await stat(join(directory, path))).size
      } catch (error) {
        // A file removed between the walk and its stat holds no bytes.
        if ((error as { readonly code?: unknown }).code === 'ENOENT') return 0
        throw error
      }
    })
  )
  return sizes.reduce((sum, size) => sum + size, 0)
}

export const localExists = async (directory: string, key: string): Promise<boolean> => {
  const filePath = resolveStoragePath(directory, key)
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}
