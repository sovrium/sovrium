/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile, writeFile, rm } from 'node:fs/promises'
import { Effect, Console } from 'effect'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import {
  computeConfigHash,
  getReloadMessageFilePath,
  isProcessRunning,
  readLockFile,
  writeLockFile,
} from '@/infrastructure/server/lock-file'
import { lazyImportSchema } from './utils'

interface ReloadOptions {
  readonly message: string | undefined
  readonly force: boolean
}

const parseReloadArgs = (argv: readonly string[]): ReloadOptions => {
  const messageIndex = argv.indexOf('--message')
  const message =
    messageIndex >= 0 && argv.length > messageIndex + 1 ? argv[messageIndex + 1] : undefined
  return { message, force: argv.includes('--force') }
}

const isDrifted = async (port: number | undefined): Promise<boolean> => {
  if (port === undefined) return false
  try {
    const response = await fetch(`http://localhost:${port}/api/admin/schema/status`)
    if (!response.ok) return false
    const body = (await response.json()) as { readonly driftStatus?: string }
    return body.driftStatus === 'drifted-from-file'
  } catch {
    return false
  }
}

export const handleReloadCommand = async (argv: readonly string[] = []): Promise<void> => {
  const options = parseReloadArgs(argv)
  const lockData = await readLockFile()
  if (!lockData) {
    Effect.runSync(Console.error('Error: No server is running (lock file not found)'))
    process.exit(1)
  }

  if (!isProcessRunning(lockData.pid)) {
    Effect.runSync(Console.error('Error: Server is not running'))
    process.exit(1)
  }

  if (!options.force && (await isDrifted(lockData.port))) {
    Effect.runSync(
      Console.error(
        'Error: live app has drifted from the config file (drift detected). Pass --force to overwrite the live schema with the file.'
      )
    )
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

  if (options.message !== undefined && options.message.length > 0) {
    try {
      await writeFile(getReloadMessageFilePath(), options.message, 'utf-8')
    } catch {
    }
  } else {
    try {
      await rm(getReloadMessageFilePath(), { force: true })
    } catch {
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
