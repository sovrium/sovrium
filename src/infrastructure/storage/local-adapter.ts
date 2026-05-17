/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { constants } from 'node:fs'
import { access, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

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
 * Resolve a storage path and verify it stays within the base directory.
 * Prevents path traversal attacks (e.g., key = "../../etc/passwd").
 */
const resolveStoragePath = (directory: string, key: string): string => {
  const base = resolve(directory)
  const target = resolve(directory, key)
  if (!target.startsWith(base + '/') && target !== base) {
    // eslint-disable-next-line functional/no-throw-statements -- Security boundary: path traversal must throw to prevent file access outside storage
    throw new Error(`Path traversal detected: key "${key}" escapes storage directory`)
  }
  return target
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

export const localDelete = async (directory: string, key: string): Promise<void> => {
  const filePath = resolveStoragePath(directory, key)
  await unlink(filePath)
}

export const localList = async (directory: string, prefix: string): Promise<readonly string[]> => {
  const targetDir = prefix ? resolveStoragePath(directory, prefix) : directory
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
