/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname } from 'node:path'
import { Effect, Console } from 'effect'
import { getCurrentVersion, checkForUpdatesInBackground } from '@/cli/commands/update'
import { START_HELP_TEXT } from '@/cli/runtime/command-help'
import { warnDeprecatedKeys } from '@/cli/runtime/config-deprecation-warnings'
import { formatConfigRejection, isConfigRejectedError } from '@/domain/errors/config-rejected'
import {
  isStrictPortBoot,
  resolveBindHost,
  resolveListenUnix,
  resolveSovriumLogFormat,
} from '@/domain/models/process-env/server-lifecycle'
import { printStderr, renderStderr } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { activateLogFormat } from '@/infrastructure/logging/log-format'
import {
  isProcessRunning,
  listenLabel,
  readLockFile,
  removeLockFile,
} from '@/infrastructure/server/lock-file'
import {
  findPortHolderPid,
  isPortFree,
  portInUseMessage,
  resolveHostAddresses,
} from '@/infrastructure/server/port-availability'
import { isPublicDirOptOut, readPublicDirEnv, resolveDefaultPublicDir } from './option-parsing'
import { watchConfigGraph } from './start-watch'
import { lazyImportIndex, lazyImportLogger, lazyImportCli, resolveConfigAnchor } from './utils'
import { collectConfigAttribution } from './validate'
import type { StartOptions } from '@/application/use-cases/server/start-server-options'

const showStartHelp = (): void => {
  Effect.runSync(Console.log(START_HELP_TEXT))
}

/**
 * Parse server options from environment variables.
 *
 * `publicDir` here surfaces the RAW env value (including the `'none'` opt-out
 * sentinel) so the caller can apply opt-out semantics with full knowledge —
 * masking it inside this helper would lose the distinction between "unset"
 * and "explicitly disabled". Path resolution / default fallback is the
 * caller's job (see `handleStartCommand`).
 */
const parseStartOptions = (): StartOptions => {
  const port = Bun.env.PORT
  // The public-assets directory may be configured purely via the env var,
  // with no PORT set, so it must be read independently of the port. The bind
  // host is not read here: `createServer` resolves it (`resolveBindHost`), so
  // the deprecated-`HOSTNAME` notice is printed by the one place that binds.
  const publicDir = readPublicDirEnv()

  const parsedPort = port ? parseInt(port, 10) : undefined
  if (parsedPort !== undefined && (isNaN(parsedPort) || parsedPort < 0 || parsedPort > 65_535)) {
    printStderr(
      `Error: Invalid port number "${port}". Must be between 0 and 65535 (0 = auto-select).`
    )
    // Terminate process - imperative statement required for CLI
    process.exit(1)
  }

  return {
    ...(parsedPort !== undefined && { port: parsedPort }),
    ...(publicDir && { publicDir }),
  }
}

/** The port a boot with no `PORT` binds, as `createServer` resolves it. */
const DEFAULT_PORT = 3000

/**
 * Refuse a strict boot (`isStrictPortBoot`) whose port another process holds,
 * BEFORE the boot touches anything: no migration has run and no lock or status
 * file exists, which is what lets the refusal say it changed nothing. The real
 * bind refuses too (`startBunServer`), closing the window after this probe.
 */
const refuseBusyStrictPort = async (options: StartOptions): Promise<void> => {
  const port = options.port ?? DEFAULT_PORT
  // A socket-bound boot (`SOVRIUM_LISTEN_UNIX`) opens no port to collide on.
  if (port === 0 || !isStrictPortBoot() || resolveListenUnix() !== undefined) return
  const hostname = options.hostname ?? resolveBindHost(process.env).host
  if (isPortFree(hostname, port, await resolveHostAddresses(hostname))) return
  const holderPid = findPortHolderPid(port)
  printStderr(portInUseMessage({ hostname, port, holderPid, changedNothing: true }))
  process.exit(1)
}

/**
 * Handle the 'start' command
 *
 * `helpRequested` is forwarded from `src/cli/index.ts` when `--help`/`-h`
 * follows a positional (e.g. `start app.yaml --watch --help`). Without this
 * short-circuit, `--watch` would attach an `fs.watch` handle and keep the
 * process alive forever —.
 */
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
  // Before anything prints: every line this server writes follows the format.
  activateLogFormat(resolveSovriumLogFormat(process.env))

  const { start } = await lazyImportIndex()
  const { logDebug } = await lazyImportLogger()
  const { resolveAppSchema } = await lazyImportCli()

  // `configFile` — NOT the `filePath` parameter — is what every anchor below
  // keys off. The two differ in exactly one case: auto-discovery, where the
  // operator named no file so `filePath` stays `undefined` while a config sits
  // in the working directory all the same. Reading `filePath` there left
  // `public/`, the config hash, `SOVRIUM_CONTENT_DIR` and `--watch` unanchored,
  // so `sovrium start --watch` beside an `app.yaml` watched nothing at all.
  // Deprecated keys still decode, so only a walk of the raw config sees them.
  const { app, configFile } = warnDeprecatedKeys(await resolveAppSchema('start', filePath))
  const envOptions = parseStartOptions()
  // Fallback chain: explicit --publicDir flag wins; otherwise SOVRIUM_PUBLIC_DIR
  // env var; otherwise the anchored `./public` next to the config file. The
  // `--no-publicDir` flag and the `SOVRIUM_PUBLIC_DIR=none` sentinel BOTH
  // disable serving outright (no env-fallback, no default). When the config
  // is inline (`APP_SCHEMA=...`) there is no anchor → no default.
  const envValue = envOptions.publicDir
  const explicitOptOut = publicDir === false || isPublicDirOptOut(envValue)
  const userResolvedPublicDir = explicitOptOut
    ? undefined
    : ((publicDir || undefined) ?? envValue ?? resolveDefaultPublicDir(configFile))

  // Public-pages search artifacts are NOT emitted here. `startServer` builds
  // them as a step of its own boot sequence, which is what makes them a
  // property of the server rather than of this command — the `--watch` reload
  // and the in-process E2E fixture boot the same server and would get a 404
  // on `/sovrium-search/*` if only this call site emitted them.
  //
  // The ephemeral-publicDir allocation lives in the boot too, for the same reason: an
  // inline config (`APP_SCHEMA=...`, no `--publicDir`, no file anchor) has
  // nowhere to put the artifacts, and the boot is the only place that knows
  // whether it needs one. All this command still owes the boot is the one bit
  // it alone can answer — whether static assets were REFUSED (`--no-publicDir`,
  // `SOVRIUM_PUBLIC_DIR=none`) as opposed to merely left unset, which is the
  // difference between "allocate a temp dir for search" and "serve nothing".
  const options: StartOptions = {
    ...envOptions,
    ...(userResolvedPublicDir && { publicDir: userResolvedPublicDir }),
    ...(explicitOptOut && { publicDirOptOut: true }),
  }

  // What identifies this config, for the lock file and `X-Sovrium-Config`.
  // Shared with every `--watch` reload so the two never hash different bytes.
  const { configHash, configPath } = await resolveConfigAnchor(configFile, app)

  // Anchor relative markdown/contentDir paths to the config-file directory so
  // content resolves regardless of the process CWD (mirrors resolveDefaultPublicDir).
  // An explicit SOVRIUM_CONTENT_DIR (e.g. from the E2E harness, which has no
  // config-file path) always wins; the presentation resolvers read this env var.
  if (configPath && !process.env['SOVRIUM_CONTENT_DIR']) {
    process.env['SOVRIUM_CONTENT_DIR'] = dirname(configPath)
  }

  // Check for existing lock file (stale or active)
  const existingLock = await readLockFile()
  if (existingLock && isProcessRunning(existingLock.pid)) {
    // Active server — refuse to start
    printStderr(
      `Error: Server already running (PID: ${existingLock.pid}, ${listenLabel(existingLock)})`
    )
    process.exit(1)
  }
  // Before the stale-lock cleanup, so a refusal really leaves the disk untouched.
  await refuseBusyStrictPort(options)
  if (existingLock) {
    // Stale lock — clean up and continue
    printStderr(`Removing stale lock file (PID ${existingLock.pid} is not running)`)
    await removeLockFile()
  }

  logDebug(`[CLI] App: ${app.name}${app.description ? ` - ${app.description}` : ''}`)
  if (configFile) logDebug(`[CLI] Config: ${configFile}`)
  if (options.port) logDebug(`[CLI] Port: ${options.port}`)
  if (options.hostname) logDebug(`[CLI] Hostname: ${options.hostname}`)
  if (options.publicDir) logDebug(`[CLI] Public directory: ${options.publicDir}`)
  if (watchMode) logDebug(`[CLI] Watch mode: enabled`)

  // Start the server.
  //
  // A REFUSED CONFIG IS NOT A CRASH. A refusal is prose the author should read;
  // a fault is a stack an engineer should trace. So the refusal prints as prose
  // and everything else keeps its stack — that contrast is the rule, and it is
  // recorded on `ConfigRejectedError` itself.
  //
  // BOTH BRANCHES GO THROUGH `renderStderr`. The fault branch does not pass the
  // Error OBJECT to `Console.error` for Bun's pretty printer: that printer
  // colours its output on a TTY, which the terminal-output rules ban outright.
  // `formatRuntimeError` keeps the diagnosis: it returns `.stack` for a plain
  // Error and unwraps an Effect `FiberFailure` through `Cause.pretty` — strictly
  // better than the pretty printer, which renders a FiberFailure as the useless
  // "An error has occurred". The one thing it lacks is Bun's source-context
  // window (the excerpt from `src/index.ts`); the stack that window decorates
  // survives, and it is the stack the contrast above actually turns on. Same helper the `[search-index]` site upstream uses.
  //
  // The `$ref` source map, so a refusal names the partial each problem lives in
  // exactly as `sovrium validate` does — the report is meant to be the same one.
  const attribution = await collectConfigAttribution(configFile)
  const server = await start(app, { ...options, configHash, configPath }, attribution).catch(
    (error) => {
      Effect.runSync(
        isConfigRejectedError(error)
          ? renderStderr(formatConfigRejection(error, 'started'))
          : renderStderr(`Failed to start server: ${formatRuntimeError(error)}`)
      )
      // Terminate process - imperative statement required for CLI
      process.exit(1)
    }
  )

  // Non-blocking background update check (binary installs only, 24h cooldown)
  const version = await getCurrentVersion()

  checkForUpdatesInBackground(version)

  // If watch mode enabled, set up file watchers over the whole config graph
  if (watchMode && configFile) {
    await watchConfigGraph({ configFile, server, app, configHash, configPath, options })
  }
}
