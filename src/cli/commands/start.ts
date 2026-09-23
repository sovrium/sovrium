/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, relative, resolve } from 'node:path'
import { Effect, Console } from 'effect'
import { getCurrentVersion, checkForUpdatesInBackground } from '@/cli/commands/update'
import { START_HELP_TEXT } from '@/cli/runtime/command-help'
import { formatConfigRejection, isConfigRejectedError } from '@/domain/errors/config-rejected'
import { messageAsConfigFinding } from '@/domain/models/app/app-excess-property-report'
import {
  formatDuration,
  printJournal,
  printJournalError,
  printJournalWarning,
  printStderr,
  renderStderr,
} from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { isProcessRunning, readLockFile, removeLockFile } from '@/infrastructure/server/lock-file'
import { publishRejectedSave, publishServerStatus } from '@/infrastructure/server/status-file'
import { createConfigGraphWatcher } from './config-graph-watcher'
import { snapshotConfigGraph } from './config-snapshot-history'
import { isPublicDirOptOut, readPublicDirEnv, resolveDefaultPublicDir } from './option-parsing'
import { createReloadScheduler } from './reload-scheduler'
import {
  lazyImportIndex,
  lazyImportLogger,
  lazyImportCli,
  lazyImportSchema,
  reloadServer,
  resolveConfigAnchor,
} from './utils'
import type { ReloadFailure, ReloadSuccess } from './utils'
import type { ConfigChangeVerdict } from '@/application/use-cases/config/classify-config-change'
import type { StartOptions } from '@/application/use-cases/server/start-server'
import type { ReloadKind, ReloadOutcomeLabel } from '@/infrastructure/server/status-file'

const showStartHelp = (): void => {
  Effect.runSync(Console.log(START_HELP_TEXT))
}

/**
 * The sentence a failed reload owes the operator, and the cause underneath it.
 *
 * ONE SENTENCE PER OUTCOME, and each is true of the listener or is not printed.
 * What this replaces was a single constant — `the previous server is still
 * serving` — emitted on every path including the ones where the port was dead,
 * which is the one message that sends an operator looking for the fault in
 * their browser instead of in their config.
 *
 * A pre-flight refusal is PROSE and is rendered as itself. Everything else is a
 * fault and goes through `formatRuntimeError`, which unwraps an Effect cause
 * into something an engineer can trace — the same contrast the boot path draws
 * between a refused config and a crash.
 */
const describeReloadFailure = (failure: ReloadFailure): string => {
  const detail =
    failure.refusals.length > 0 ? failure.refusals.join('\n') : formatRuntimeError(failure.error)

  if (failure.serverState === 'kept') {
    return `Reload failed — the previous server is still serving.\n${detail}`
  }
  if (failure.serverState === 'rolled-back') {
    return `Reload failed — the previous configuration was restored.\n${detail}`
  }
  return (
    `Reload failed and the server is DOWN — the previous configuration could not be ` +
    `restored either. Fix the config and save again, or stop and restart the process.\n` +
    `${detail}\nRollback: ${formatRuntimeError(failure.rollbackError)}`
  )
}

/**
 * What a failed reload left behind, in the vocabulary the status file publishes.
 *
 * The same three-way distinction `ReloadServerState` draws and the printed
 * sentence turns on, carried across to the machine-readable channel rather than
 * re-derived there — so a reader polling the file and a reader watching the
 * terminal are told the same thing about the same save.
 */
const publishedOutcome = (failure: ReloadFailure): Exclude<ReloadOutcomeLabel, 'success'> =>
  failure.serverState

/** Everything in `a`, then everything in `b` that was not already there. */
const unionFiles = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...new Set([...a, ...b]),
]

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
    printStderr(
      `Error: Invalid port number "${port}". Must be between 0 and 65535 (0 = auto-select).`
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

  // Public-pages search artifacts are NOT emitted here any more. `startServer`
  // builds them as a step of its own boot sequence, which is what makes them a
  // property of the server rather than of this command — the `--watch` reload
  // and the in-process E2E fixture boot the same server and used to get a 404
  // on `/sovrium-search/*` because only this call site existed.
  //
  // The ephemeral-publicDir allocation moved with it, for the same reason: an
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
    // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- CLI startup env wiring: anchor content dir for the presentation resolvers
    process.env['SOVRIUM_CONTENT_DIR'] = dirname(configPath)
  }

  // Check for existing lock file (stale or active)
  const existingLock = await readLockFile()
  if (existingLock) {
    if (isProcessRunning(existingLock.pid)) {
      // Active server — refuse to start
      printStderr(
        `Error: Server already running (PID: ${existingLock.pid}, port: ${existingLock.port})`
      )
      // eslint-disable-next-line functional/no-expression-statements
      process.exit(1)
    }
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
  // BOTH BRANCHES NOW GO THROUGH `renderStderr`. The fault branch used to be
  // `Console.error('Failed to start server:', error)`, passing the Error OBJECT
  // so Bun's pretty printer rendered it. That printer colours its output on a
  // TTY, which T35 #3 bans outright, so the object form had to go. What
  // replaces it keeps the diagnosis: `formatRuntimeError` returns `.stack` for
  // a plain Error and unwraps an Effect `FiberFailure` through `Cause.pretty` —
  // the latter strictly better than the pretty printer, which renders a
  // FiberFailure as the useless "An error has occurred". The one thing lost is
  // Bun's source-context window (the excerpt from `src/index.ts`); the stack
  // that window decorates survives, and it is the stack the contrast above
  // actually turns on. Same helper the `[search-index]` site upstream uses.
  const server = await start(app, { ...options, configHash, configPath }).catch((error) => {
    Effect.runSync(
      isConfigRejectedError(error)
        ? renderStderr(formatConfigRejection(error, 'started'))
        : renderStderr(`Failed to start server: ${formatRuntimeError(error)}`)
    )
    // Terminate process - imperative statement required for CLI
    // eslint-disable-next-line functional/no-expression-statements
    process.exit(1)
  })

  // Non-blocking background update check (binary installs only, 24h cooldown)
  const version = await getCurrentVersion()

  checkForUpdatesInBackground(version)

  // If watch mode enabled, set up file watchers over the whole config graph
  if (watchMode && configFile) {
    // Track current server instance (mutable for watch mode)
    // eslint-disable-next-line functional/no-let
    let currentServer = server

    // The DECODED config the running server was built from. `reloadServer`
    // diffs the next save against it to decide whether that save can be
    // swapped into the live listener or needs a full teardown, so it must be
    // seeded from the boot and replaced after every successful reload —
    // including a hot one, where the server object itself does not change.
    // eslint-disable-next-line functional/no-let
    let currentApp = server.config

    // The RAW config and anchor the running server was built from. Retained
    // because they are what a rollback boots: when a restart-class save fails
    // after the listener is already down, the last-good config has to come back
    // from memory — re-reading the file would read the bad save.
    // eslint-disable-next-line functional/no-let
    let currentRawApp = app
    // eslint-disable-next-line functional/no-let
    let currentAnchor = { configHash, configPath }

    // Debounce reloads: `fs.watch` emits `change` potentially BEFORE a write is
    // flushed, and often MULTIPLE times per save (truncate, then write). Reloading
    // on the first event can read a half-written file — surfacing as a JSON
    // `Unexpected EOF` or an `AppSchema` decode-to-`null`. A real operator saving
    // config in a write-in-place editor hits the same race. So we coalesce rapid
    // events and reload only once writes settle. One window covers EVERY watched
    // file: a save that touches two modules of the graph reloads once.
    //
    // The window alone is not enough, which is why the policy now lives in
    // `createReloadScheduler` — see that module for the re-entrance guard that
    // keeps a format-on-save landing mid-reload from starting a second one.
    const RELOAD_DEBOUNCE_MS = 300

    // Name the file that changed the way the operator sees it: relative to the
    // config directory (`config/pages.ts`), never as a `../../..` walk from an
    // unrelated cwd.
    const rootDir = dirname(resolve(configFile))
    const describeChangedFile = (changedPath: string): string => {
      const fromRoot = relative(rootDir, changedPath)
      return fromRoot.startsWith('..') ? changedPath : fromRoot
    }

    /**
     * A cheap fingerprint of what the config graph currently SAYS, as opposed
     * to when it was last touched. `fs.watch` reports writes, not edits: a
     * format-on-save rewriting identical bytes is a `change` event like any
     * other, and reloading a server for it is pure waste. Comparing this
     * against the fingerprint of the last successful reload is what makes one
     * logical save produce one reload.
     */
    const readGraphSignature = async (files: ReadonlyArray<string>): Promise<string> => {
      const parts = await Promise.all(
        files.toSorted().map(async (file) => {
          const text = await Bun.file(file)
            .text()
            .catch(() => '')
          return `${file}\0${text}`
        })
      )
      return String(Bun.hash(parts.join('\0')))
    }

    // The files the fingerprint is taken over, and the fingerprint of the
    // config the running server was built from. `lastSignature` is replaced
    // only after a reload SUCCEEDS: if a reload fails, the last-good
    // fingerprint stays, so re-saving the same broken file reports the error
    // again instead of being mistaken for a no-op rewrite.
    // eslint-disable-next-line functional/no-let
    let watchedFiles: ReadonlyArray<string> = []
    // eslint-disable-next-line functional/no-let
    let lastSignature = ''
    // Whether the LAST ATTEMPT succeeded, which is the other half of the no-op
    // rule and the half that was missing.
    //
    // Comparing against the last-good fingerprint alone made the undo
    // unreachable: restoring the bytes that were there before a bad save
    // reproduces exactly `lastSignature`, so the save returned before it
    // announced anything — no reload, no error, no line. After a failure that
    // also took the port down, the undo is the operator's first move and it was
    // the one move the watcher ignored, turning a recoverable outage into a
    // permanent one.
    //
    // The rule that replaces it: a save is a no-op rewrite only when the last
    // attempt SUCCEEDED and its fingerprint is unchanged. After a failure the
    // next save always reloads, whatever it contains.
    // eslint-disable-next-line functional/no-let
    let lastAttemptSucceeded = true

    const reloadScheduler = createReloadScheduler({
      debounceMs: RELOAD_DEBOUNCE_MS,
      run: async (changedPath) => {
        const startedAt = Date.now()

        // Read the fingerprint BEFORE the reload, and commit it only once the
        // reload succeeds. Reading it afterwards would capture any edit made
        // DURING the reload — content the new server was never built from —
        // and the catch-up run would then skip it as unchanged, silently
        // losing a save. Erring the other way costs at most one extra reload.
        const signature = await readGraphSignature(watchedFiles)
        if (lastAttemptSucceeded && signature === lastSignature) return

        // ONE announcement per save, printed as late as the reload can tell us
        // what it is about to do and no later. A hot swap and a full restart
        // cost the operator very different things, so the line says which one
        // this is — and, when it is the expensive one, which key forced it.
        //
        // The announcement is deferred until the new config has been loaded and
        // classified, so a save that never gets that far (unparsable JSON, a
        // property AppSchema does not declare) has nothing to announce. The
        // catch below covers that case with the generic line, because a
        // failure the operator can see explained is still a change they need
        // told about —.
        // eslint-disable-next-line functional/no-let
        let announced = false
        // Which of the two paths this save took, captured where it is decided.
        // It stays `undefined` for a save that never got as far as being
        // classified — an unparsable file has no verdict, and publishing a
        // guessed one would tell a supervisor holding an open connection that
        // it must reconnect when nothing was ever torn down.
        // eslint-disable-next-line functional/no-let
        let announcedKind: ReloadKind | undefined
        const announce = (verdict?: ConfigChangeVerdict): void => {
          // eslint-disable-next-line functional/no-expression-statements
          announced = true
          // eslint-disable-next-line functional/no-expression-statements
          announcedKind = verdict?.kind
          const where = describeChangedFile(changedPath)
          printJournal(
            'watch',
            verdict?.kind === 'restart'
              ? `Config changed (${verdict.reason}) — full restart… (${where})`
              : `Config changed — reloading… (${where})`
          )
        }

        const outcome = await reloadServer({
          filePath: configFile,
          currentServer,
          currentApp,
          currentRawApp,
          currentAnchor,
          options,
          announce,
        }).catch((error: unknown): ReloadFailure => ({
          // Nothing above this line touches the listener, so a throw that
          // escapes `reloadServer` — which returns its failures — can only
          // come from a fault the reload never expected. `kept` is the true
          // reading of it AND the conservative one: the server object is
          // unchanged, so the next save still has something to stop.
          ok: false,
          files: [],
          phase: 'load',
          serverState: 'kept',
          refusals: [],
          findings: [messageAsConfigFinding(formatRuntimeError(error))],
          error,
          rollbackError: undefined,
          server: currentServer,
        }))

        const durationMs = Date.now() - startedAt
        if (!outcome.ok) {
          await reportFailedReload(outcome, announced ? undefined : announce, {
            kind: announcedKind,
            durationMs,
          })
          return
        }

        await commitReload(outcome, { signature, durationMs, kind: announcedKind })
      },
    })

    /**
     * Adopt a reload that worked: hold what it produced, and publish it.
     *
     * Split out of the scheduler's `run` so the bookkeeping and the decision to
     * do it are not read as one thing — and so the status write sits next to
     * the seven assignments it describes, rather than a screen away from them.
     */
    const commitReload = async (
      outcome: ReloadSuccess,
      save: {
        readonly signature: string
        readonly durationMs: number
        readonly kind: ReloadKind | undefined
      }
    ): Promise<void> => {
      // eslint-disable-next-line functional/no-expression-statements
      currentServer = outcome.server
      // eslint-disable-next-line functional/no-expression-statements
      currentApp = outcome.app
      // eslint-disable-next-line functional/no-expression-statements
      currentRawApp = outcome.rawApp
      // eslint-disable-next-line functional/no-expression-statements
      currentAnchor = outcome.anchor
      // eslint-disable-next-line functional/no-expression-statements
      watchedFiles = outcome.files
      // eslint-disable-next-line functional/no-expression-statements
      lastSignature = save.signature
      // eslint-disable-next-line functional/no-expression-statements
      lastAttemptSucceeded = true
      graphWatcher.sync(outcome.files)

      // Only on this path: a refused save leaves the history untouched, because
      // an entry that never booted would be an undo target that breaks the app.
      //
      // The snapshot NAME it answers is discarded here and nowhere else: it
      // exists for `_config_write_file`, which reports it back to the AI that
      // asked for the edit. The watcher has nobody to report it to.
      // eslint-disable-next-line functional/no-expression-statements -- see above
      await snapshotConfigGraph(configFile, outcome.files, outcome.anchor.configHash)

      // BEFORE the line below, deliberately. `[watch] Server reloaded` is what a
      // person waits for and what a test harness greps for, so anything that
      // polls the file on the strength of that line must find the new verdict
      // already there — otherwise the channel reads one save behind exactly
      // when it is being watched most closely.
      //
      // The port and the hash are republished rather than assumed: a
      // restart-class save rebinds, and the hash is what `X-Sovrium-Config`
      // now emits. A file that kept the previous hash would describe a
      // configuration that is not running, which is worse than saying nothing.
      await publishServerStatus({
        state: 'serving',
        port: outcome.server.port,
        configHash: outcome.anchor.configHash,
        configPath: outcome.anchor.configPath,
        lastReload: {
          at: new Date().toISOString(),
          ...(save.kind !== undefined && { kind: save.kind }),
          durationMs: save.durationMs,
          outcome: 'success',
          findings: [],
        },
      })

      // One line, not fourteen. The reloaded server suppresses the startup
      // banner (`StartOptions.reload`) so this summary is the whole report
      // of a save: what happened, and how long the operator waited for it.
      printJournal('watch', `Server reloaded in ${formatDuration(save.durationMs)}`)
    }

    /**
     * Report a reload that did not happen, and leave the watcher able to
     * recover from it.
     *
     * Three pieces of state change here, and each one closes a way the watcher
     * used to strand the operator:
     *
     * - the SERVER, because a rollback boots a new one and the next save has to
     *   stop that one rather than the corpse of the old;
     * - the WATCHED SET, unioned with whatever the failed attempt read, because
     *   a save that adds a `$ref` and then fails leaves the operator editing
     *   the one file nothing is following;
     * - `lastAttemptSucceeded`, because the very next save is an undo far more
     *   often than it is a no-op rewrite.
     *
     * It also publishes the refusal on the two channels nobody is watching the
     * terminal for — see {@link publishRejectedSave}. That call is the whole
     * reason this is now `async`: a refusal is the ONE outcome a reader cannot
     * infer from the port, because the last-good server keeps answering 200.
     */
    const reportFailedReload = async (
      failure: ReloadFailure,
      announceIfSilent: (() => void) | undefined,
      save: { readonly kind: ReloadKind | undefined; readonly durationMs: number }
    ): Promise<void> => {
      // A save that never got as far as being classified announced nothing, and
      // a failure the operator can see explained is still a change they need
      // told about —.
      // eslint-disable-next-line functional/no-expression-statements -- CLI side effect: announce a save that failed before it could be classified
      announceIfSilent?.()

      // ONE call per failure, because a failure is ONE event: the printer
      // splits the text and stamps every row with the same clock and tag
      // (T39, T40), so the cause arrives as a continuation of the sentence
      // that introduces it. Two calls gave it a second `Error:` word and a
      // second timestamp — one failure reading as two.
      //
      // A REFUSED CONFIG IS NOT A CRASH — the same distinction the boot path
      // draws. A stack sends the operator to debug our code instead of the
      // property they just typed. It keeps its own wording rather than the
      // three-outcome sentence because a decode refusal never reaches the
      // listener at all, which the reader can see from the words.
      if (isConfigRejectedError(failure.error)) {
        printJournalError('watch', formatConfigRejection(failure.error, 'reloaded'))
      } else {
        printJournalError('watch', describeReloadFailure(failure))
      }

      // eslint-disable-next-line functional/no-expression-statements
      currentServer = failure.server
      // eslint-disable-next-line functional/no-expression-statements
      lastAttemptSucceeded = false
      // eslint-disable-next-line functional/no-expression-statements
      watchedFiles = unionFiles(watchedFiles, failure.files)
      graphWatcher.sync(watchedFiles)

      await publishRejectedSave({
        kind: save.kind,
        durationMs: save.durationMs,
        phase: failure.phase,
        outcome: publishedOutcome(failure),
        findings: failure.findings,
      })
    }

    // The watched set is DERIVED from the loaded config, never declared: the
    // root, every TypeScript module it imports and every file it reaches
    // through `$ref`, at any depth. It is re-derived after every successful
    // reload, because a reload can add or drop an import or a `$ref` — a newly
    // referenced file must become watched, a dropped one must stop triggering.
    const graphWatcher = createConfigGraphWatcher((changedPath) => {
      reloadScheduler.schedule(changedPath)
    })

    // The initial watched set. The config already loaded (the server is up),
    // so this only collects the files it was read from: a YAML/JSON root is
    // re-read and its `$ref`s followed, a `.ts` root is bundled without being
    // imported. Should that collection fail anyway, the root stays watched —
    // exactly the coverage the watcher had before it followed the graph.
    const { collectConfigGraphFiles } = await lazyImportSchema()
    const rootPath = resolve(configFile)
    const initialFiles = await collectConfigGraphFiles(configFile).catch((error: unknown) => {
      // A WARNING, not an error (T41): the watcher survives this degraded — it
      // still watches the root, so saves are still noticed; only the files
      // LINKED from it are not. The cause rides along as a continuation row so
      // the whole report shares one clock.
      printJournalWarning(
        'watch',
        `Could not follow the files linked from ${configFile} — watching it alone.\n${formatRuntimeError(error)}`
      )
      return [rootPath]
    })
    graphWatcher.sync(initialFiles)

    // The boot is an accepted config, so it is snapshotted. Undo after the very
    // first edit has to land HERE — without this entry the history after one
    // change holds only the state the user is trying to leave.
    //
    // The name it answers is discarded — see the reload-path call above.
    // eslint-disable-next-line functional/no-expression-statements -- see above
    await snapshotConfigGraph(configFile, initialFiles, currentAnchor.configHash)

    // Seed the change detector with what the RUNNING server was built from, so
    // the first `change` event is compared against reality rather than against
    // an empty fingerprint (which would make every first event a reload, even
    // a touch that changed nothing).
    // eslint-disable-next-line functional/no-expression-statements
    watchedFiles = initialFiles
    // eslint-disable-next-line functional/no-expression-statements
    lastSignature = await readGraphSignature(initialFiles)

    // The root is always part of the set (a graph is never empty), so every
    // other watched file is a linked one.
    const linkedCount = Math.max(0, graphWatcher.size() - 1)
    printJournal(
      'watch',
      linkedCount > 0
        ? `Watching ${configFile} and ${linkedCount} linked file${linkedCount === 1 ? '' : 's'} for changes`
        : `Watching ${configFile} for changes`
    )
  }
}
