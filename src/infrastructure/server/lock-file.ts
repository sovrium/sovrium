/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultLockDir } from '@/domain/models/env/data-dir'

const LOCK_FILE_NAME = 'lock'

/**
 * Get the directory for the lock file.
 * Uses SOVRIUM_LOCK_DIR env var if set (e.g., for parallel test isolation),
 * otherwise defaults to the consolidated data dir (`<SOVRIUM_DATA_DIR>`,
 * default `./.sovrium/`).
 */
const getLockDir = (): string => process.env.SOVRIUM_LOCK_DIR || defaultLockDir()

/**
 * Lock file data stored on disk for server management
 */
export interface LockFileData {
  readonly pid: number
  readonly port: number | undefined
  readonly configHash: string
  readonly configPath: string
}

/**
 * Compute a SHA-256 hash of a string and return first 12 hex characters
 */
export const computeConfigHash = (content: string): string => {
  const hasher = new Bun.CryptoHasher('sha256')
  // eslint-disable-next-line functional/no-expression-statements
  hasher.update(content)
  return hasher.digest('hex').slice(0, 12)
}

/**
 * Get the lock file path (in SOVRIUM_LOCK_DIR or the data dir).
 *
 * Exported so the synchronous shutdown cleanup in `server.ts` resolves the
 * exact same path the async writer uses (single source of truth).
 */
export const getLockFilePath = (): string => join(getLockDir(), LOCK_FILE_NAME)

/**
 * Sidecar file used by `sovrium reload` to pass the `--message "..."` value
 * to the running server's SIGUSR1 handler. Signals carry no payload, so the
 * CLI writes the message here pre-signal and the handler reads-and-deletes
 * it once the new version row is appended. Missing file ⇒ no message ⇒
 * server uses its default fallback.
 */
export const getReloadMessageFilePath = (): string => join(getLockDir(), 'reload-message')

/**
 * Write a lock file to disk.
 *
 * Creates the lock directory first — the consolidated data dir
 * (`./.sovrium/`) may not exist yet on a fresh project.
 */
export const writeLockFile = async (data: LockFileData): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements
  await mkdir(getLockDir(), { recursive: true })
  // eslint-disable-next-line functional/no-expression-statements
  await writeFile(getLockFilePath(), JSON.stringify(data), 'utf-8')
}

/**
 * Read the lock file from disk
 * Returns undefined if file does not exist or cannot be parsed
 */
export const readLockFile = async (): Promise<LockFileData | undefined> => {
  try {
    const content = await readFile(getLockFilePath(), 'utf-8')
    return JSON.parse(content) as LockFileData
  } catch {
    return undefined
  }
}

/**
 * Remove the lock file from disk
 */
export const removeLockFile = async (): Promise<void> => {
  // eslint-disable-next-line functional/no-expression-statements
  await rm(getLockFilePath(), { force: true })
}

/**
 * Check if a process with the given PID is still running
 */
export const isProcessRunning = (pid: number): boolean => {
  try {
    // eslint-disable-next-line functional/no-expression-statements
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
