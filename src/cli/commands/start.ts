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

/**
 * Parse server options from environment variables
 */
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
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  }

  return {
    ...(parsedPort !== undefined && { port: parsedPort }),
    ...(hostname && { hostname }),
  }
}

/**
 * Handle the 'start' command
 */
// eslint-disable-next-line max-lines-per-function, max-statements, complexity
export const handleStartCommand = async (filePath?: string, watchMode = false): Promise<void> => {
  const { start } = await lazyImportIndex()
  const { logDebug } = await lazyImportLogger()
  const { parseAppSchema } = await lazyImportCli()

  const app = await parseAppSchema('start', filePath)
  const options = parseStartOptions()

  // Compute config hash and absolute path for lock file
  const configContent = filePath ? await readFile(filePath, 'utf-8') : JSON.stringify(app)
  const configHash = computeConfigHash(configContent)
  const configPath = filePath ? resolve(filePath) : ''

  // Check for existing lock file (stale or active)
  const existingLock = await readLockFile()
  if (existingLock) {
    if (isProcessRunning(existingLock.pid)) {
      // Active server — refuse to start
      Effect.runSync(
        Console.error(
          `Error: Server already running (PID: ${existingLock.pid}, port: ${existingLock.port})`
        )
      )
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }
    // Stale lock — clean up and continue
    Effect.runSync(
      Console.error(`Removing stale lock file (PID ${existingLock.pid} is not running)`)
    )
    // eslint-disable-next-line functional/no-expression-statements
    await removeLockFile()
  }

  logDebug(`[CLI] App: ${app.name}${app.description ? ` - ${app.description}` : ''}`)
  if (filePath) logDebug(`[CLI] Config: ${filePath}`)
  if (options.port) logDebug(`[CLI] Port: ${options.port}`)
  if (options.hostname) logDebug(`[CLI] Hostname: ${options.hostname}`)
  if (watchMode) logDebug(`[CLI] Watch mode: enabled`)

  // Start the server
  const server = await start(app, { ...options, configHash, configPath }).catch((error) => {
    Effect.runSync(Console.error('Failed to start server:', error))
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })

  // Non-blocking background update check (binary installs only, 24h cooldown)
  const version = await getCurrentVersion()

  checkForUpdatesInBackground(version)

  // If watch mode enabled, set up file watcher
  if (watchMode && filePath) {
    console.log(`\n  [watch] Watching ${filePath} for changes\n`)

    // Track current server instance (mutable for watch mode)
    // eslint-disable-next-line functional/no-let
    let currentServer = server

    // Set up file watcher using Node.js fs.watch (stable in Bun)

    watch(filePath, async (eventType) => {
      if (eventType === 'change') {
        console.log(`\n  [watch] Config changed, reloading`)

        try {
          // eslint-disable-next-line functional/no-expression-statements
          currentServer = await reloadServer(filePath, currentServer, options)

          console.log(`  [watch] Server reloaded successfully\n`)
        } catch (error) {
          // reloadServer can fail with any Effect-y error (schema decode,
          // CSS compile, DB migration). formatRuntimeError unwraps the
          // Cause/TaggedError so the watch operator sees what actually
          // broke. See commit 68b20a5af.
          console.error(`  [watch] Reload failed: ${formatRuntimeError(error)}\n`)
          // Keep the old server running on error
        }
      }
    })
  }
}
