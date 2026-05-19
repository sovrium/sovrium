/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { constants } from 'node:fs'
import { access, mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const localValidateDirectory = async (directory: string): Promise<void> => {
  await mkdir(directory, { recursive: true })
  await access(directory, constants.W_OK)
}

const resolveStoragePath = (directory: string, key: string): string => {
  const base = resolve(directory)
  const target = resolve(directory, key)
  if (!target.startsWith(base + '/') && target !== base) {
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
