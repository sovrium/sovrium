/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile } from 'node:fs/promises'
import { Effect, Console } from 'effect'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import {
  computeConfigHash,
  isProcessRunning,
  readLockFile,
  writeLockFile,
} from '@/infrastructure/server/lock-file'
import { lazyImportSchema } from './utils'

export const handleReloadCommand = async (): Promise<void> => {
  const lockData = await readLockFile()
  if (!lockData) {
    Effect.runSync(Console.error('Error: No server is running (lock file not found)'))
    process.exit(1)
  }

  if (!isProcessRunning(lockData.pid)) {
    Effect.runSync(Console.error('Error: Server is not running'))
    process.exit(1)
  }

  if (lockData.configPath) {
    try {
      const content = await readFile(lockData.configPath, 'utf-8')

      const { loadSchemaFromFile } = await lazyImportSchema()
      const parsed = await loadSchemaFromFile(lockData.configPath)
      const { Schema: S } = await import('effect')
      const { AppSchema } = await import('@/domain/models/app')
      S.decodeUnknownSync(AppSchema)(parsed)

      const newHash = computeConfigHash(content)
      await writeLockFile({ ...lockData, configHash: newHash })
    } catch (error) {
      const message = formatRuntimeError(error)
      Effect.runSync(Console.error(`Error: Invalid configuration - ${message}`))
      process.exit(1)
    }
  }

  try {
    process.kill(lockData.pid, 'SIGUSR1')
  } catch {
    Effect.runSync(Console.error('Error: Failed to send reload signal'))
    process.exit(1)
  }

  Effect.runSync(Console.log('Configuration reloaded'))
}
