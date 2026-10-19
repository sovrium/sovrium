/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Every regular file below `root`, as POSIX paths relative to it, sorted —
 * without following a symbolic link anywhere in the tree.
 *
 * The walk is our own because Bun's `readdir(root, { recursive: true })`
 * descends THROUGH a symlinked directory (Node's does not): a link planted in
 * the folder makes the listing name files that live elsewhere on disk, and a
 * link cycle rejects the whole listing with `ELOOP`. Here a link — to a file
 * or to a directory, dangling or not — is neither listed nor entered, so
 * everything returned really sits under `root`.
 *
 * A failure reading `root` itself (a missing directory included) rejects;
 * the caller decides what an absent folder means.
 */
export const listFilesBelow = async (root: string): Promise<readonly string[]> => {
  const walk = async (relativeDir: string): Promise<readonly string[]> => {
    const entries = await readdir(join(root, relativeDir), { withFileTypes: true })
    const nested = await Promise.all(
      entries.map(async (entry): Promise<readonly string[]> => {
        const path = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`
        if (entry.isSymbolicLink()) return []
        if (entry.isDirectory()) return walk(path)
        return entry.isFile() ? [path] : []
      })
    )
    return nested.flat()
  }
  return (await walk('')).toSorted()
}
