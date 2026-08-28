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
import { START_HELP_TEXT } from '@/cli/command-help'
import { getCurrentVersion, checkForUpdatesInBackground } from '@/cli/update'
import { formatConfigRejection, isConfigRejectedError } from '@/domain/errors/config-rejected'
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
  const hostname = Bun.env.HOSTNAME
  // The public-assets directory may be configured purely via the env var,
  // with no PORT/HOSTNAME set, so it must be read independently of the
  // early-return guard below.
  const publicDir = readPublicDirEnv()

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
    ...(publicDir && { publicDir }),
  }
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

  const { start } = await lazyImportIndex()
  const { logDebug } = await lazyImportLogger()
  const { resolveAppSchema } = await lazyImportCli()

  // `configFile` — NOT the `filePath` parameter — is what every anchor below
  // keys off. The two differ in exactly one case: auto-discovery, where the
  // operator named no file so `filePath` stays `undefined` while a config sits
  // in the working directory all the same. Reading `filePath` there left
  // `public/`, the config hash, `SOVRIUM_CONTENT_DIR` and `--watch` unanchored,
  // so `sovrium start --watch` beside an `app.yaml` watched nothing at all.
  const { app, configFile } = await resolveAppSchema('start', filePath)
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

  // Public-pages search activation: when the schema declares a `pageSearch`
  // component, materialize the search artifacts BEFORE the server boots so
  // `/sovrium-search/index.json` + `/sovrium-search/runtime.js` are servable
  // from request one. The `setupPublicDirRoute` then auto-serves them as
  // ordinary static assets (no extra route registration needed).
  //
  // Why "before boot": the search runtime is not generated lazily — it's a
  // build artifact, identical in shape to `sovrium build`'s output. Mirroring
  // build()'s pre-emission posture keeps the two paths semantically equivalent.
  //
  // PublicDir allocation: when the user did not configure one (e.g. inline
  // `APP_SCHEMA=...` with no `--publicDir` and no config-file anchor), we
  // allocate an ephemeral temp directory just to host the search artifacts.
  // This is invisible to the operator — only `/sovrium-search/*` paths are
  // written, so nothing else accidentally becomes a static asset. Opt-out
  // (`--no-publicDir`) suppresses search-asset serving along with everything
  // else; the indexer is skipped in that case.
  //
  // Cleanup posture: the allocated dir persists for the server's lifetime and
  // is NOT removed on shutdown. The OS reaps `/tmp` periodically (Linux:
  // systemd-tmpfiles ≥10 days, macOS: 3 days), so it's acceptable churn for
  // a CLI that may restart many times. If that ever becomes an observable
  // problem, the place to remove it is `installShutdownHandlers`
  // (`infrastructure/server/lifecycle.ts`), which owns the whole SIGTERM/SIGINT
  // path — there is nothing left to compete with.
  // `parseAppSchema` returns `AppEncoded` (raw input shape) whereas
  // `hasPageSearchComponent` accepts the decoded `App` type. The predicate
  // only reads `.pages` and `.components` — both shape-compatible across
  // encoded/decoded — so the cast is safe in practice. The cheap walk lets
  // us decide whether to allocate a temp publicDir; the full validated
  // schema is re-walked inside `prebuildSearchIndex` for the actual build.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AppEncoded vs App
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
    // eslint-disable-next-line functional/no-expression-statements -- CLI side effect: pre-boot indexer write
    await prebuildSearchIndex(app, resolvedPublicDir).catch((error) => {
      // Indexer failure must not block server startup — log and continue.
      // The static-asset route will simply 404 search requests, which is the
      // same observable behavior as a schema without `pageSearch`. The
      // operator sees a clear diagnostic in the server log.
      //
      // EXCEPT a refused config: the indexer runs the same decode `start` is
      // about to run, so it fails first and would print a stack immediately
      // above the real refusal. Stay silent and let `start` do the talking.
      if (isConfigRejectedError(error)) return
      Effect.runSync(
        Console.error(`[search-index] failed to pre-build: ${formatRuntimeError(error)}`)
      )
    })
  }

  // Compute config hash and absolute path for lock file
  const configContent = configFile ? await readFile(configFile, 'utf-8') : JSON.stringify(app)
  const configHash = computeConfigHash(configContent)
  const configPath = configFile ? resolve(configFile) : ''

  // Anchor relative markdown/contentDir paths to the config-file directory so
  // content resolves regardless of the process CWD (mirrors resolveDefaultPublicDir).
  // An explicit SOVRIUM_CONTENT_DIR (e.g. from the E2E harness, which has no
  // config-file path) always wins; the presentation resolvers read this env var.
  if (configPath && !process.env['SOVRIUM_CONTENT_DIR']) {
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- CLI startup env wiring: anchor content dir for the presentation resolvers
    process.env['SOVRIUM_CONTENT_DIR'] = dirname(configPath)
  }

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
  if (configFile) logDebug(`[CLI] Config: ${configFile}`)
  if (options.port) logDebug(`[CLI] Port: ${options.port}`)
  if (options.hostname) logDebug(`[CLI] Hostname: ${options.hostname}`)
  if (options.publicDir) logDebug(`[CLI] Public directory: ${options.publicDir}`)
  if (watchMode) logDebug(`[CLI] Watch mode: enabled`)

  // Start the server.
  //
  // A REFUSED CONFIG IS NOT A CRASH. `Console.error(msg, error)` hands the Error
  // object to Bun's pretty printer, which prefixes a source-context window from
  // `src/index.ts` — the right thing for a fault, and the wrong thing for "your
  // config declares a property we do not understand", where it buries the
  // diagnosis under a stack frame in code the reader did not write. So the
  // refusal prints as prose and everything else keeps its stack.
  const server = await start(app, { ...options, configHash, configPath }).catch((error) => {
    Effect.runSync(
      isConfigRejectedError(error)
        ? Console.error(formatConfigRejection(error, 'started'))
        : Console.error('Failed to start server:', error)
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })

  // Non-blocking background update check (binary installs only, 24h cooldown)
  const version = await getCurrentVersion()

  checkForUpdatesInBackground(version)

  // If watch mode enabled, set up file watcher
  if (watchMode && configFile) {
    console.log(`\n  [watch] Watching ${configFile} for changes\n`)

    // Track current server instance (mutable for watch mode)
    // eslint-disable-next-line functional/no-let
    let currentServer = server

    // Set up file watcher using Node.js fs.watch (stable in Bun).
    //
    // Debounce reloads: `fs.watch` emits `change` potentially BEFORE a write is
    // flushed, and often MULTIPLE times per save (truncate, then write). Reloading
    // on the first event can read a half-written file — surfacing as a JSON
    // `Unexpected EOF` or an `AppSchema` decode-to-`null`. A real operator saving
    // config in a write-in-place editor hits the same race. So we coalesce rapid
    // events and reload only once writes settle, which also prevents overlapping
    // concurrent reloads.
    const RELOAD_DEBOUNCE_MS = 150
    // eslint-disable-next-line functional/no-let
    let reloadTimer: ReturnType<typeof setTimeout> | undefined

    watch(configFile, (eventType) => {
      if (eventType !== 'change') return

      if (reloadTimer !== undefined) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(async () => {
        console.log(`\n  [watch] Config changed — reloading…`)

        try {
          // eslint-disable-next-line functional/no-expression-statements
          currentServer = await reloadServer(configFile, currentServer, options)

          console.log(`  [watch] Server reloaded\n`)
        } catch (error) {
          // reloadServer can fail with any Effect-y error (schema decode,
          // CSS compile, DB migration). formatRuntimeError unwraps the
          // Cause/TaggedError so the watch operator sees what actually
          // broke. See commit 68b20a5af.
          //
          // A REFUSED CONFIG IS NOT A CRASH — the same distinction the boot
          // path draws above. A stack sends the operator to debug our code
          // instead of the property they just typed.
          console.error(
            isConfigRejectedError(error)
              ? `  [watch] ${formatConfigRejection(error, 'reloaded')}\n`
              : `  [watch] Reload failed — the previous server is still serving.\n  [watch] ${formatRuntimeError(error)}\n`
          )
          // The old server is still serving — for a config error. `reloadServer`
          // decodes the new config BEFORE it stops the running one, so the class
          // of mistake a watching operator actually makes (a typo, a property
          // AppSchema does not declare) never costs them the port. A failure
          // later in the reload — CSS, migrations — happens after the stop and
          // does leave the server down; see `reloadServer` for why that half
          // cannot be pre-flighted.
        }
      }, RELOAD_DEBOUNCE_MS)
    })
  }
}
