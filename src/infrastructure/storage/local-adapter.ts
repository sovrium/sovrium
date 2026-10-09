/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { constants } from 'node:fs'
import { access, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { isCanonicalStorageKey } from '@/domain/kernel/identity/storage-key'

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
const resolveStoragePath = (directory: string, key: string): string => {
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

export const localDownload = async (directory: string, key: string): Promise<Uint8Array> => {
  const filePath = resolveStoragePath(directory, key)
  const file = Bun.file(filePath)
  return new Uint8Array(await file.arrayBuffer())
}

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

export const localList = async (directory: string, prefix: string): Promise<readonly string[]> => {
  const targetDir = prefix ? resolveConfinedPath(directory, prefix) : directory
  try {
    const entries = await readdir(targetDir, { recursive: true })
    return entries.map((e) => (prefix ? `${prefix}/${String(e)}` : String(e)))
  } catch {
    return []
  }
}

/**
 * Recursively sum file sizes under `directory`. Returns 0 when the directory
 * does not exist or is empty. Used for `STORAGE_MAX_TOTAL_SIZE` quota
 * enforcement on the local-filesystem provider.
 */
export const localGetTotalBytes = async (directory: string): Promise<number> => {
  try {
    const entries = await readdir(directory, { recursive: true })
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        try {
          const filePath = resolve(directory, String(entry))
          const fileStat = await stat(filePath)
          return fileStat.isFile() ? fileStat.size : 0
        } catch {
          return 0
        }
      })
    )
    return sizes.reduce((sum, size) => sum + size, 0)
  } catch {
    return 0
  }
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
