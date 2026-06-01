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

const getLockDir = (): string => process.env.SOVRIUM_LOCK_DIR || defaultLockDir()

export interface LockFileData {
  readonly pid: number
  readonly port: number | undefined
  readonly configHash: string
  readonly configPath: string
}

export const computeConfigHash = (content: string): string => {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(content)
  return hasher.digest('hex').slice(0, 12)
}

export const getLockFilePath = (): string => join(getLockDir(), LOCK_FILE_NAME)

export const getReloadMessageFilePath = (): string => join(getLockDir(), 'reload-message')

export const writeLockFile = async (data: LockFileData): Promise<void> => {
  await mkdir(getLockDir(), { recursive: true })
  await writeFile(getLockFilePath(), JSON.stringify(data), 'utf-8')
}

export const readLockFile = async (): Promise<LockFileData | undefined> => {
  try {
    const content = await readFile(getLockFilePath(), 'utf-8')
    return JSON.parse(content) as LockFileData
  } catch {
    return undefined
  }
}

export const removeLockFile = async (): Promise<void> => {
  await rm(getLockFilePath(), { force: true })
}

export const isProcessRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
