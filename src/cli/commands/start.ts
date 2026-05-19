/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Effect, Console } from 'effect'
import { getCurrentVersion, checkForUpdatesInBackground } from '@/cli/update'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import {
  computeConfigHash,
  isProcessRunning,
  readLockFile,
  removeLockFile,
} from '@/infrastructure/server/lock-file'
import { lazyImportIndex, lazyImportLogger, lazyImportCli, reloadServer } from './utils'
import type { StartOptions } from '@/application/use-cases/server/start-server'

const parseStartOptions = (): StartOptions => {
  const port = Bun.env.PORT
  const hostname = Bun.env.HOSTNAME

  if (!port && !hostname) {
    return {}
  }

  const parsedPort = port ? parseInt(port, 10) : undefined
  if (parsedPort !== undefined && (isNaN(parsedPort) || parsedPort < 0 || parsedPort > 65_535)) {
    Effect.runSync(
      Console.error(
        `Error: Invalid port number "${port}". Must be between 0 and 65535 (0 = auto-select).`
      )
    )
    process.exit(1)
  }

  return {
    ...(parsedPort !== undefined && { port: parsedPort }),
    ...(hostname && { hostname }),
  }
}

export const handleStartCommand = async (filePath?: string, watchMode = false): Promise<void> => {
  const { start } = await lazyImportIndex()
  const { logDebug } = await lazyImportLogger()
  const { parseAppSchema } = await lazyImportCli()

  const app = await parseAppSchema('start', filePath)
  const options = parseStartOptions()

  const configContent = filePath ? await readFile(filePath, 'utf-8') : JSON.stringify(app)
  const configHash = computeConfigHash(configContent)
  const configPath = filePath ? resolve(filePath) : ''

  const existingLock = await readLockFile()
  if (existingLock) {
    if (isProcessRunning(existingLock.pid)) {
      Effect.runSync(
        Console.error(
          `Error: Server already running (PID: ${existingLock.pid}, port: ${existingLock.port})`
        )
      )
      process.exit(1)
    }
    Effect.runSync(
      Console.error(`Removing stale lock file (PID ${existingLock.pid} is not running)`)
    )
    await removeLockFile()
  }

  logDebug(`[CLI] App: ${app.name}${app.description ? ` - ${app.description}` : ''}`)
  if (filePath) logDebug(`[CLI] Config: ${filePath}`)
  if (options.port) logDebug(`[CLI] Port: ${options.port}`)
  if (options.hostname) logDebug(`[CLI] Hostname: ${options.hostname}`)
  if (watchMode) logDebug(`[CLI] Watch mode: enabled`)

  const server = await start(app, { ...options, configHash, configPath }).catch((error) => {
    Effect.runSync(Console.error('Failed to start server:', error))
    process.exit(1)
  })

  const version = await getCurrentVersion()

  checkForUpdatesInBackground(version)

  if (watchMode && filePath) {
    console.log(`\n  [watch] Watching ${filePath} for changes\n`)

    let currentServer = server


    watch(filePath, async (eventType) => {
      if (eventType === 'change') {
        console.log(`\n  [watch] Config changed, reloading`)

        try {
          currentServer = await reloadServer(filePath, currentServer, options)

          console.log(`  [watch] Server reloaded successfully\n`)
        } catch (error) {
          console.error(`  [watch] Reload failed: ${formatRuntimeError(error)}\n`)
        }
      }
    })
  }
}
