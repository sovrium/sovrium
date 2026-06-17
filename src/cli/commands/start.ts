/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { watch } from 'node:fs'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Effect, Console } from 'effect'
import { getCurrentVersion, checkForUpdatesInBackground } from '@/cli/update'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import {
  computeConfigHash,
  isProcessRunning,
  readLockFile,
  removeLockFile,
} from '@/infrastructure/server/lock-file'
import { isPublicDirOptOut, readPublicDirEnv, resolveDefaultPublicDir } from './option-parsing'
import { lazyImportIndex, lazyImportLogger, lazyImportCli, reloadServer } from './utils'
import type { StartOptions } from '@/application/use-cases/server/start-server'

const START_HELP_TEXT = [
  'Usage: sovrium start [config] [options]',
  '',
  'Start a Sovrium server from a YAML/JSON/TS config file.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '',
  'Options:',
  '  --watch, -w                   Watch config file and hot-reload on change',
  '  --publicDir <path>            Directory of static assets to serve at /',
  '                                (default: ./public next to app.yaml, if present)',
  '  --no-publicDir                Disable static-asset serving entirely',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables (all optional — Sovrium runs zero-config):',
  '  APP_SCHEMA                    Inline JSON/YAML or remote URL (alternative to file arg)',
  '  PORT                          Server port (default: 3000)',
  '  HOSTNAME                      Server hostname (default: localhost)',
  '  DATABASE_URL                  Postgres connection (omit → embedded SQLite)',
  '  AUTH_SECRET                   Auth signing secret (run: sovrium secret generate)',
  '  SOVRIUM_PUBLIC_DIR            Static-asset directory (or "none" to disable)',
  '',
  'Examples:',
  '  sovrium start app.yaml                   # Boot with app.yaml (serves ./public if present)',
  '  sovrium start app.yaml --watch           # Hot reload on file change',
  '  sovrium start app.yaml --no-publicDir    # Disable static-asset serving',
  '  PORT=8080 sovrium start app.json         # Override port',
].join('\n')

const showStartHelp = (): void => {
  Effect.runSync(Console.log(START_HELP_TEXT))
}

const parseStartOptions = (): StartOptions => {
  const port = Bun.env.PORT
  const hostname = Bun.env.HOSTNAME
  const publicDir = readPublicDirEnv()

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
    ...(publicDir && { publicDir }),
  }
}

export const handleStartCommand = async (
  filePath?: string,
  watchMode = false,
  publicDir?: string | false,
  helpRequested = false
): Promise<void> => {
  if (helpRequested) {
    showStartHelp()
    return
  }

  const { start } = await lazyImportIndex()
  const { logDebug } = await lazyImportLogger()
  const { parseAppSchema } = await lazyImportCli()

  const app = await parseAppSchema('start', filePath)
  const envOptions = parseStartOptions()
  const envValue = envOptions.publicDir
  const explicitOptOut = publicDir === false || isPublicDirOptOut(envValue)
  const userResolvedPublicDir = explicitOptOut
    ? undefined
    : ((publicDir || undefined) ?? envValue ?? resolveDefaultPublicDir(filePath))

  const needsSearchIndex = !explicitOptOut && hasPageSearchComponent(app as any)
  const allocatedSearchPublicDir =
    needsSearchIndex && !userResolvedPublicDir
      ? await mkdtemp(join(tmpdir(), 'sovrium-search-public-'))
      : undefined
  const resolvedPublicDir = userResolvedPublicDir ?? allocatedSearchPublicDir

  const options: StartOptions = {
    ...envOptions,
    ...(resolvedPublicDir && { publicDir: resolvedPublicDir }),
  }

  if (needsSearchIndex && resolvedPublicDir) {
    const { prebuildSearchIndex } = await lazyImportIndex()
    await prebuildSearchIndex(app, resolvedPublicDir).catch((error) => {
      Effect.runSync(
        Console.error(`[search-index] failed to pre-build: ${formatRuntimeError(error)}`)
      )
    })
  }

  const configContent = filePath ? await readFile(filePath, 'utf-8') : JSON.stringify(app)
  const configHash = computeConfigHash(configContent)
  const configPath = filePath ? resolve(filePath) : ''

  if (configPath && !process.env['SOVRIUM_CONTENT_DIR']) {
    process.env['SOVRIUM_CONTENT_DIR'] = dirname(configPath)
  }

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
  if (options.publicDir) logDebug(`[CLI] Public directory: ${options.publicDir}`)
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
