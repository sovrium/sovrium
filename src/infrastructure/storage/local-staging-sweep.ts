/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { listFilesBelow } from '@/infrastructure/filesystem/list-files-below'
import { isStagedPath } from './local-adapter'

/**
 * How old a staged file must be before the local provider removes it as left
 * behind. A staged file lives only while one write moves it into place, so one
 * this old belongs to a write that never finished — the process stopped
 * between the two steps — and no key will ever be renamed onto from it.
 */
export const STAGING_ORPHAN_AGE_MS = 60 * 60 * 1000

const codeOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null
    ? (error as { readonly code?: unknown }).code
    : undefined

/** Remove the staged file at `path` when it is at least `olderThanMs` old at `now`. */
const removeIfAged = async (path: string, olderThanMs: number, now: number): Promise<boolean> => {
  try {
    const { mtimeMs } = await stat(path)
    if (now - mtimeMs < olderThanMs) return false
    await unlink(path)
    return true
  } catch (error) {
    // Gone between the walk and here: a write that finished, or another sweep.
    if (codeOf(error) === 'ENOENT') return false
    throw error
  }
}

/**
 * Remove every staged file under `directory` at least `olderThanMs` old at
 * `now`, and answer the paths removed, relative to `directory`. A staged file
 * younger than that is a write still in progress and is left alone. A
 * directory that is not there holds nothing to remove.
 */
export const sweepOrphanedStaging = async (
  directory: string,
  olderThanMs: number = STAGING_ORPHAN_AGE_MS,
  now: number = Date.now()
): Promise<readonly string[]> => {
  const files = await listFilesBelow(directory).catch((error: unknown) => {
    if (codeOf(error) === 'ENOENT') return []
    throw error
  })
  const staged = files.filter(isStagedPath)
  const removed = await Promise.all(
    staged.map(async (path) =>
      (await removeIfAged(join(directory, path), olderThanMs, now)) ? [path] : []
    )
  )
  return removed.flat()
}

/** The sweep each directory has had in this process. */
const sweeps = new Map<string, Promise<readonly string[]>>()

/**
 * {@link sweepOrphanedStaging} at most once per directory per process: the
 * provider is built again by every layer that provides it, and a sweep walks
 * the whole directory. A sweep that failed is not retried until the next start.
 */
export const sweepOrphanedStagingOnce = (
  directory: string,
  sweep: (directory: string) => Promise<readonly string[]> = sweepOrphanedStaging
): Promise<readonly string[]> => {
  const started = sweeps.get(directory)
  if (started !== undefined) return started.then(() => [])
  const running = sweep(directory)
  sweeps.set(directory, running)
  return running
}
