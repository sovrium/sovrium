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

/**
 * Handle the 'reload' command -- send SIGUSR1 to running server to reload config
 */
// eslint-disable-next-line max-statements
export const handleReloadCommand = async (): Promise<void> => {
  const lockData = await readLockFile()
  if (!lockData) {
    Effect.runSync(Console.error('Error: No server is running (lock file not found)'))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  if (!isProcessRunning(lockData.pid)) {
    Effect.runSync(Console.error('Error: Server is not running'))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  // Read and validate the config file before sending reload signal
  if (lockData.configPath) {
    try {
      const content = await readFile(lockData.configPath, 'utf-8')

      // Validate the config using Effect Schema
      const { loadSchemaFromFile } = await lazyImportSchema()
      const parsed = await loadSchemaFromFile(lockData.configPath)
      const { Schema: S } = await import('effect')
      const { AppSchema } = await import('@/domain/models/app')
      // Throws on invalid schema -- expression statement is intentional validation
      // eslint-disable-next-line functional/no-expression-statements
      S.decodeUnknownSync(AppSchema)(parsed)

      // Update lock file with new config hash
      const newHash = computeConfigHash(content)
      // eslint-disable-next-line functional/no-expression-statements
      await writeLockFile({ ...lockData, configHash: newHash })
    } catch (error) {
      // S.decodeUnknownSync(AppSchema) throws ParseError on schema violations.
      // formatRuntimeError unwraps it via TreeFormatter so users see the
      // failing path (e.g. "tables.0.fields.2.type") instead of a generic
      // "An error has occurred". See commit 68b20a5af.
      const message = formatRuntimeError(error)
      Effect.runSync(Console.error(`Error: Invalid configuration - ${message}`))
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }
  }

  // Send SIGUSR1 to trigger config reload in running server
  try {
    // eslint-disable-next-line functional/no-expression-statements
    process.kill(lockData.pid, 'SIGUSR1')
  } catch {
    Effect.runSync(Console.error('Error: Failed to send reload signal'))
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  Effect.runSync(Console.log('Configuration reloaded'))
}
