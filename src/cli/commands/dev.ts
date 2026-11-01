/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium dev` — the development loop in one command.
 *
 * Every run wipes and recreates a dedicated data directory (`.sovrium/dev/`),
 * creates a predictable admin account, loads `seed/`, turns dev mode on (the
 * panel showing that account on every page), boots the watcher through
 * `handleStartCommand`, prints a block an agent can act on, and opens the
 * sign-in page. A second run while one is live attaches to it instead.
 *
 * ## Why the static imports are so few
 *
 * The render tree reads the dev-mode panel's configuration ONCE, when its
 * module loads. So everything the dev session decides about the environment —
 * the data dir, the lock dir, every `SOVRIUM_DEV_*` — is assigned BEFORE the
 * server modules are imported, and this file statically imports only modules
 * that read the environment at call time: the lock and status files, the data
 * dir, the CLI output, the browser launcher and the dev session's own facts.
 *
 * ## Why `admin create` and `seed` run as child processes
 *
 * `seed` ends in `process.exit`, and neither may share a SQLite file with a
 * live writer. Both run, one after the other, as children of this same
 * program (`@/cli/runtime/project-data`, shared with `init --with-demo-data`),
 * and both have finished before the server starts.
 */

import { readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { isHeadless, openInBrowser } from '@/cli/runtime/browser-launch'
import {
  devAdminEmail,
  devDataDir,
  devOpenUrl,
  externalDatabaseRefusal,
  readDevSession,
  resolveDevPassword,
  writeDevSession,
} from '@/cli/runtime/dev-session'
import {
  formatDevSessionBlock,
  formatRunningSessionBlock,
  type DataOutcome,
  type OpenOutcome,
  type OtherInstance,
} from '@/cli/runtime/dev-session-block'
import { defineFlags, flag } from '@/cli/runtime/flag-schema'
import { prepareProjectData } from '@/cli/runtime/project-data'
import { stopCommand, withFlagsAsync } from '@/cli/runtime/run-command'
import { parseDataDir } from '@/domain/models/process-env/data-dir'
import { parseProjectDir } from '@/domain/models/process-env/desktop'
import { ensurePrivateDirectory } from '@/infrastructure/filesystem/private-modes'
import { printDocument, printStderr } from '@/infrastructure/logging/cli-output'
import {
  isProcessRunning,
  lockFilePathIn,
  readLockFile,
  type LockFileData,
} from '@/infrastructure/server/lock-file'
import { getStatusFilePath, readStatusDocument } from '@/infrastructure/server/status-file'
import type { App } from '@/domain/models/app'

/** Options forwarded from the CLI dispatcher. */
export interface DevCommandOptions {
  readonly configFile?: string
  /** `false` under `--no-open`. */
  readonly open: boolean
  /** `--external-database`: the `DATABASE_URL` database is meant for development. */
  readonly externalDatabase: boolean
  readonly publicDir?: string | false
}

/** Where the panel's "Learn more" link points when the environment names nothing else. */
export const DEV_MANUAL_URL = 'https://sovrium.com/en/docs'

/** The live instance a lock file names, or `undefined` (no file, unreadable, or a dead pid). */
const readLiveLock = async (path: string): Promise<OtherInstance | undefined> => {
  try {
    const lock = JSON.parse(await readFile(path, 'utf-8')) as LockFileData
    return typeof lock.pid === 'number' && isProcessRunning(lock.pid) ? lock : undefined
  } catch {
    return undefined
  }
}

/** Set `key` unless the environment already holds a non-empty value for it. */
const prefill = (key: string, value: string): void => {
  if ((process.env[key] ?? '') === '') process.env[key] = value
}

/** Attach to a live dev session: print it, change nothing. */
const printRunningSession = async (
  lock: LockFileData,
  devDir: string,
  configFile: string | undefined,
  other: OtherInstance | undefined
): Promise<void> => {
  const status = await readStatusDocument()
  const requested = configFile === undefined ? undefined : resolve(configFile)
  printDocument(
    formatRunningSessionBlock({
      lock,
      session: await readDevSession(devDir),
      statusPath: getStatusFilePath(),
      status,
      otherConfig: requested !== undefined && requested !== lock.configPath ? requested : undefined,
      other,
    })
  )
}

/** Create the dev admin and load `seed/`, as children; exit 1 when the admin cannot be created. */
const prepareData = (input: {
  readonly app: App
  readonly configFile: string
  readonly devDir: string
  readonly email: string
  readonly password: string
}): Pick<DataOutcome, 'adminCreated' | 'seed'> => {
  const { app, configFile, devDir, email, password } = input
  const prepared = prepareProjectData({
    hasAuth: app.auth !== undefined,
    configFile,
    email,
    password,
    seedArgs: ['--report', join(devDir, 'dev-seed-report.json')],
    seedEnv: { SOVRIUM_SEED_PASSWORD: password },
  })
  if (!prepared.ok) {
    return stopCommand(1, `Error: could not create the dev account ${email}.\n${prepared.output}`)
  }
  if (prepared.seed === 'failed') printStderr(prepared.seedOutput)
  return { adminCreated: prepared.adminCreated, seed: prepared.seed }
}

/** Why the browser was, or was not, asked to open `url`; opens it when it may. */
const openSession = (url: string, open: boolean, socket: boolean): OpenOutcome => {
  if (!open) return 'not opened: --no-open'
  if (socket || isHeadless()) return 'not opened: headless'
  openInBrowser(url)
  return 'opened'
}

/**
 * Exit 1 on a config `sovrium validate` refuses, printing its report. The
 * decode alone is not enough: an unknown field type decodes, then refuses to
 * boot — after the previous session's data would already be gone.
 */
const refuseInvalidConfig = async (configFile: string): Promise<void> => {
  const { loadConfigForValidationWithSources, validateParsedConfig } = await import('./validate')
  const { parsed, refSources } = await loadConfigForValidationWithSources(configFile)
  const outcome = await validateParsedConfig(parsed, refSources, configFile)
  if (outcome.valid) return
  return stopCommand(1, `Error: Validation failed.\n\n${outcome.report.join('\n')}`)
}

/** The flags `sovrium dev` reads. */
export const devFlags = defineFlags({
  noOpen: flag.switch('--no-open'),
  externalDatabase: flag.switch('--external-database'),
})

/**
 * Handle `sovrium dev` from the parsed command line: the browser opens unless
 * `--no-open` is among the arguments, and a `DATABASE_URL` database is used
 * only under `--external-database`.
 */
export const handleDevCommand = withFlagsAsync(devFlags, ({ configFile, publicDir, flags }) =>
  runDevSession({
    configFile,
    publicDir,
    open: !flags.noOpen,
    externalDatabase: flags.externalDatabase,
  })
)

/**
 * Point the data and lock dirs at the dev dir and turn dev mode on — before any
 * server module loads. Answers the dev dir and the live `sovrium start` of the
 * same project, whose lock is resolved BEFORE the environment is replaced.
 */
const enterDevEnvironment = async (): Promise<{
  readonly devDir: string
  readonly other: OtherInstance | undefined
}> => {
  const devDir = devDataDir(parseProjectDir(process.env))
  const normalLockPath = lockFilePathIn(
    process.env['SOVRIUM_LOCK_DIR'] || parseDataDir(process.env)
  )
  process.env['SOVRIUM_DATA_DIR'] = devDir
  process.env['SOVRIUM_LOCK_DIR'] = devDir
  process.env['SOVRIUM_DEV_MODE'] = 'on'
  return { devDir, other: await readLiveLock(normalLockPath) }
}

/**
 * The config, its decoded app and the dev account — or exit 1, with nothing
 * changed, on an invalid config, a refused password or a refused database.
 */
const loadDevApp = async (
  requested: string | undefined,
  externalDatabase: boolean
): Promise<{
  readonly configFile: string
  readonly app: App
  readonly email: string
  readonly password: string
}> => {
  const { discoverConfigFile, requireApp } = await import('./app-prelude')
  const configFile = resolve(requested ?? (await discoverConfigFile()))
  await refuseInvalidConfig(configFile)
  const { app } = await requireApp(configFile)
  const { resolvePasswordPolicy } = await import('@/domain/models/app/auth/password-policy')
  const resolution = resolveDevPassword(process.env, resolvePasswordPolicy(app.auth).minLength)
  if ('refusal' in resolution) {
    return stopCommand(1, resolution.refusal)
  }
  const refusal = externalDatabaseRefusal(
    process.env,
    externalDatabase,
    resolution.source,
    app.auth !== undefined
  )
  if (refusal !== undefined) {
    return stopCommand(1, refusal)
  }
  return { configFile, app, email: devAdminEmail(app.name), password: resolution.password }
}

/** Every `SOVRIUM_DEV_*` the panel reads, an ambient non-empty value winning key by key. */
const prefillDevMode = (app: App, email: string, password: string): void => {
  prefill('SOVRIUM_DEV_NAME', app.name)
  prefill('SOVRIUM_DEV_URL', DEV_MANUAL_URL)
  if (app.auth === undefined) return
  prefill('SOVRIUM_DEV_EMAIL', email)
  process.env['SOVRIUM_DEV_PASSWORD'] = password
}

/** Run one dev session. Persistent on a boot; returns at once on an attach. */
const runDevSession = async (options: DevCommandOptions): Promise<void> => {
  const { devDir, other } = await enterDevEnvironment()
  // Before any config is read, so the answer holds on a config saved mid-edit.
  const lock = await readLockFile()
  if (lock !== undefined && isProcessRunning(lock.pid)) {
    return printRunningSession(lock, devDir, options.configFile, other)
  }
  // An invalid config, or a DATABASE_URL dev may not use, exits 1 here, before anything is written.
  const { configFile, app, email, password } = await loadDevApp(
    options.configFile,
    options.externalDatabase
  )
  // A database on disk under the dev dir is reset; a DATABASE_URL one is never dropped.
  const kept = (process.env['DATABASE_URL'] ?? '') !== ''
  if (!kept) await rm(devDir, { recursive: true, force: true })
  ensurePrivateDirectory(devDir)
  const prepared = prepareData({ app, configFile, devDir, email, password })
  prefillDevMode(app, email, password)

  const { handleStartCommand } = await import('./start')
  const started = await handleStartCommand(configFile, true, options.publicDir)
  if (started === undefined) return
  const facts = {
    app,
    started,
    configFile,
    devDir,
    email,
    password,
    options,
    other,
    kept,
    prepared,
  }
  await printBootedSession(facts)
}

/** Record the session, print its block and open the browser. */
const printBootedSession = async (input: {
  readonly app: App
  readonly started: { readonly server: { readonly url: string; readonly config: App } }
  readonly configFile: string
  readonly devDir: string
  readonly email: string
  readonly password: string
  readonly options: DevCommandOptions
  readonly other: OtherInstance | undefined
  readonly kept: boolean
  readonly prepared: Pick<DataOutcome, 'adminCreated' | 'seed'>
}): Promise<void> => {
  const { app, started, devDir, email, password, options } = input
  const { adminConsoleLocator } = await import('@/infrastructure/server/startup-phase-report')
  const { configToolName } = await import('@/application/use-cases/config/config-mcp-tools')
  const { resolveListenUnix } = await import('@/domain/models/process-env/server-lifecycle')
  const { url } = started.server
  const openUrl = devOpenUrl(app, url)
  const signIn = app.auth === undefined ? undefined : { email, password }
  await writeDevSession(devDir, {
    appName: app.name,
    ...signIn,
    url,
    signInUrl: openUrl,
    startedAt: new Date().toISOString(),
  })
  const open = openSession(openUrl, options.open, resolveListenUnix(process.env) !== undefined)
  printDocument(
    formatDevSessionBlock({
      appName: app.name,
      url,
      adminUrl: adminConsoleLocator(started.server.config, url),
      openUrl,
      open,
      signIn,
      devDir,
      data: { kept: input.kept, ...input.prepared },
      configPath: input.configFile,
      statusPath: getStatusFilePath(),
      statusTool: configToolName(app.name, 'status'),
      other: input.other,
    })
  )
}
