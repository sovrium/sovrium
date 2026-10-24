/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { messageAsConfigFinding } from '@/domain/models/app/app-excess-property-report'
import { printJournal, printJournalWarning } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { onReloadRequest } from '@/infrastructure/server/lock-file-cleanup'
import { createConfigGraphWatcher } from './config-graph-watcher'
import { snapshotConfigGraph } from './config-snapshot-history'
import { createReloadScheduler } from './reload-scheduler'
import { lazyImportSchema, reloadServer } from './utils'
import { commitReload, readGraphSignature, reportFailedReload } from './watch-reload-outcome'
import type { ReloadFailure, ReloadServerParams } from './utils'
import type { WatchContext, WatchState } from './watch-reload-outcome'
import type { ConfigChangeVerdict } from '@/application/use-cases/config/classify-config-change'
import type { StartOptions } from '@/application/use-cases/server/start-server-options'

/** What `sovrium start` hands the reload path once the server is up. */
export interface ReloadSession {
  /** Path of the config graph's root file. */
  readonly configFile: string
  /** The server the boot started. */
  readonly server: ReloadServerParams['currentServer']
  /** The raw config the boot was built from — what a rollback boots. */
  readonly app: ReloadServerParams['currentRawApp']
  readonly configHash: string
  readonly configPath: string
  readonly options: StartOptions
  /** `--watch`: a save reloads too, not only `sovrium reload`. */
  readonly watch: boolean
  /** The root file's text just before the boot read it, when it was readable. */
  readonly bootConfigText?: string
  /** When the boot began reading the config graph (`Date.now()`). */
  readonly bootReadStartedAt?: number
}

/** The graph watcher of a start WITHOUT `--watch`: it follows no file. */
const NO_FILE_WATCHER: WatchContext['graphWatcher'] = { sync: () => undefined, size: () => 0 }

/**
 * Debounce reloads: `fs.watch` emits `change` potentially BEFORE a write is
 * flushed, and often MULTIPLE times per save (truncate, then write). Reloading
 * on the first event can read a half-written file — surfacing as a JSON
 * `Unexpected EOF` or an `AppSchema` decode-to-`null`. A real operator saving
 * config in a write-in-place editor hits the same race. So we coalesce rapid
 * events and reload only once writes settle. One window covers EVERY watched
 * file: a save that touches two modules of the graph reloads once.
 *
 * The window alone is not enough, which is why the policy now lives in
 * `createReloadScheduler` — see that module for the re-entrance guard that
 * keeps a format-on-save landing mid-reload from starting a second one.
 */
const RELOAD_DEBOUNCE_MS = 300

/**
 * A throw that escaped `reloadServer`, which returns its failures. Nothing
 * before it touches the listener, so it can only come from a fault the reload
 * never expected. `kept` is the true reading of it AND the conservative one:
 * the server object is unchanged, so the next save still has something to stop.
 */
const unexpectedFailure = (
  server: ReloadServerParams['currentServer'],
  error: unknown
): ReloadFailure => ({
  ok: false,
  files: [],
  phase: 'load',
  serverState: 'kept',
  refusals: [],
  findings: [messageAsConfigFinding(formatRuntimeError(error))],
  error,
  rollbackError: undefined,
  server,
})

/**
 * One debounced save or `sovrium reload`, from fingerprint to verdict.
 * `requested` marks a reload the operator asked for: it runs even when no
 * file changed, because the command waits for its verdict.
 */
const runReload = async (
  ctx: WatchContext,
  changedPath: string,
  requested: boolean
): Promise<void> => {
  const { state } = ctx
  const startedAt = Date.now()

  // Read the fingerprint BEFORE the reload, and commit it only once the
  // reload succeeds. Reading it afterwards would capture any edit made
  // DURING the reload — content the new server was never built from —
  // and the catch-up run would then skip it as unchanged, silently
  // losing a save. Erring the other way costs at most one extra reload.
  const signature = await readGraphSignature(state.watchedFiles)
  if (!requested && state.lastAttemptSucceeded && signature === state.lastSignature) return

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
  // told about.
  let announced = false
  // Which of the two paths this save took, captured where it is decided.
  // It stays `undefined` for a save that never got as far as being
  // classified — an unparsable file has no verdict, and publishing a
  // guessed one would tell a supervisor holding an open connection that
  // it must reconnect when nothing was ever torn down.
  let announcedVerdict: ConfigChangeVerdict | undefined
  const announce = (verdict?: ConfigChangeVerdict): void => {
    announced = true
    announcedVerdict = verdict
    const where = requested ? 'sovrium reload' : ctx.describeChangedFile(changedPath)
    printJournal(
      ctx.tag,
      verdict?.kind === 'restart'
        ? `Config changed (${verdict.reason}) — full restart… (${where})`
        : `Config changed — reloading… (${where})`
    )
  }

  const outcome = await reloadServer({
    filePath: ctx.configFile,
    currentServer: state.currentServer,
    currentApp: state.currentApp,
    currentRawApp: state.currentRawApp,
    currentAnchor: state.currentAnchor,
    options: ctx.options,
    announce,
  }).catch((error: unknown) => unexpectedFailure(state.currentServer, error))

  const durationMs = Date.now() - startedAt
  if (!outcome.ok) {
    await reportFailedReload(ctx, outcome, announced ? undefined : announce, {
      kind: announcedVerdict?.kind,
      durationMs,
    })
    return
  }

  await commitReload(ctx, outcome, {
    signature,
    durationMs,
    kind: announcedVerdict?.kind,
    reason: announcedVerdict?.kind === 'restart' ? announcedVerdict.reason : undefined,
  })
}

/**
 * The initial watched set. The config already loaded (the server is up),
 * so this only collects the files it was read from: a YAML/JSON root is
 * re-read and its `$ref`s followed, a `.ts` root is bundled without being
 * imported. Should that collection fail anyway, the root stays watched —
 * exactly the coverage the watcher had before it followed the graph.
 */
const collectInitialFiles = async (configFile: string): Promise<ReadonlyArray<string>> => {
  const { collectConfigGraphFiles } = await lazyImportSchema()
  const rootPath = resolve(configFile)
  return collectConfigGraphFiles(configFile).catch((error: unknown) => {
    // A WARNING, not an error: the watcher survives this degraded — it
    // still watches the root, so saves are still noticed; only the files
    // LINKED from it are not. The cause rides along as a continuation row so
    // the whole report shares one clock.
    printJournalWarning(
      'watch',
      `Could not follow the files linked from ${configFile} — watching it alone.\n${formatRuntimeError(error)}`
    )
    return [rootPath]
  })
}

/** Whether the root file no longer holds the text the boot started from. */
const rootChangedDuringBoot = async (
  configFile: string,
  bootConfigText: string | undefined
): Promise<boolean> => {
  if (bootConfigText === undefined) return false
  const now = await Bun.file(configFile)
    .text()
    .catch(() => undefined)
  return now !== undefined && now !== bootConfigText
}

/**
 * How far a file's mtime can trail the wall clock it was written at. Linux
 * stamps files from its coarse clock, up to one scheduler tick (10 ms at
 * HZ=100) behind `Date.now()`, so a save landing in the first tick of the boot
 * read can carry an mtime BEFORE `bootReadStartedAt`. The cost of the slack is
 * one extra reload for a file saved within it before the boot began, which no
 * one types that fast.
 */
const MTIME_COARSENESS_MS = 10

/** Whether a file was modified at or after `since`; an unreadable (deleted) file was not. */
const modifiedSince = async (file: string, since: number): Promise<boolean> => {
  const modified = await stat(file).then(
    (info) => info.mtimeMs,
    () => undefined
  )
  return modified !== undefined && modified >= since - MTIME_COARSENESS_MS
}

/**
 * Whether any file of the graph changed while the boot was reading it: the
 * root no longer holding the text the boot started from, or any file — the
 * root or one it links to, at any depth — modified after the boot began.
 */
const graphChangedDuringBoot = async (
  session: ReloadSession,
  files: ReadonlyArray<string>
): Promise<boolean> => {
  if (await rootChangedDuringBoot(session.configFile, session.bootConfigText)) return true
  const since = session.bootReadStartedAt
  if (since === undefined) return false
  const modified = await Promise.all(files.map((file) => modifiedSince(file, since)))
  return modified.includes(true)
}

/**
 * The fixed parts of one session around the state it mutates.
 *
 * The watched set is DERIVED from the loaded config, never declared: the root,
 * every TypeScript module it imports and every file it reaches through `$ref`,
 * at any depth. It is re-derived after every successful reload, because a
 * reload can add or drop an import or a `$ref` — a newly referenced file must
 * become watched, a dropped one must stop triggering.
 */
const createWatchContext = (
  session: ReloadSession,
  state: WatchState,
  schedule: (changedPath: string) => void
): WatchContext => {
  const rootDir = dirname(resolve(session.configFile))
  return {
    configFile: session.configFile,
    options: session.options,
    state,
    tag: session.watch ? 'watch' : 'reload',
    history: session.watch,
    graphWatcher: session.watch ? createConfigGraphWatcher(schedule) : NO_FILE_WATCHER,
    describeChangedFile: (changedPath) => {
      const fromRoot = relative(rootDir, changedPath)
      return fromRoot.startsWith('..') ? changedPath : fromRoot
    },
  }
}

/**
 * Hold the reload path of a running server for as long as the process lives:
 * `sovrium reload` (SIGUSR1) runs it on every start, and under `--watch` every
 * logical save of the config graph runs it too, through the same scheduler,
 * so a signal and a save never overlap.
 *
 * A pending `sovrium reload` is held beside the scheduler rather than in the
 * path it schedules, so a save landing in the same debounce window cannot turn
 * it into a skipped no-op; it is taken before anything is awaited, so a signal
 * sent the moment the lock file exists finds someone listening. Without
 * `--watch` nothing is followed and every reload is one the operator asked
 * for, so the graph is not walked at boot: the reload reads it.
 */
export const holdReloadPath = async (session: ReloadSession): Promise<void> => {
  const { configFile, server } = session
  const state: WatchState = {
    currentServer: server,
    currentApp: server.config,
    currentRawApp: session.app,
    currentAnchor: { configHash: session.configHash, configPath: session.configPath },
    watchedFiles: [],
    lastSignature: '',
    lastAttemptSucceeded: true,
  }

  const requests = new Set<'reload'>()
  const reloadScheduler = createReloadScheduler({
    debounceMs: RELOAD_DEBOUNCE_MS,
    run: (changedPath) => runReload(ctx, changedPath, requests.delete('reload')),
  })

  const ctx = createWatchContext(session, state, (changedPath) => {
    reloadScheduler.schedule(changedPath)
  })

  onReloadRequest(() => {
    requests.add('reload')
    reloadScheduler.schedule(resolve(configFile))
  })

  const initialFiles = session.watch ? await collectInitialFiles(configFile) : [resolve(configFile)]
  ctx.graphWatcher.sync(initialFiles)

  // Seed the change detector with what the RUNNING server was built from, so
  // the first `change` event is compared against reality rather than against
  // an empty fingerprint (which would make every first event a reload, even
  // a touch that changed nothing).
  state.watchedFiles = initialFiles
  state.lastSignature = await readGraphSignature(initialFiles)

  if (!session.watch) return

  // A save that landed while the boot was reading the config fired before the
  // watcher existed, and the fingerprint above was taken of the SAVED bytes —
  // so it would pass as already served. What the boot started from tells them
  // apart: when the root no longer holds the text it read, or any file of the
  // graph was modified after the read began, the save is reloaded now, once.
  //
  // The order is what loses nothing: the watcher is up before the fingerprint
  // is read, and the fingerprint is read before this comparison, so a save
  // lands either before the comparison (which sees it) or after the
  // fingerprint (which the watcher's own event then finds different).
  const savedDuringBoot = await graphChangedDuringBoot(session, initialFiles)
  if (savedDuringBoot) {
    state.lastSignature = ''
    reloadScheduler.schedule(resolve(configFile))
  }

  // The boot is an accepted config, so it is snapshotted. Undo after the very
  // first edit has to land HERE — without this entry the history after one
  // change holds only the state the user is trying to leave.
  //
  // Not when a save landed during the boot: the files on disk are then the
  // SAVED bytes, which have not served, and the history holds served configs
  // only. The reload just scheduled records them if they are accepted.
  //
  // The name it answers is discarded — see the reload-path call above.
  if (!savedDuringBoot) {
    await snapshotConfigGraph(configFile, initialFiles, state.currentAnchor.configHash)
  }

  // The root is always part of the set (a graph is never empty), so every
  // other watched file is a linked one.
  const linkedCount = Math.max(0, ctx.graphWatcher.size() - 1)
  printJournal(
    'watch',
    linkedCount > 0
      ? `Watching ${configFile} and ${linkedCount} linked file${linkedCount === 1 ? '' : 's'} for changes`
      : `Watching ${configFile} for changes`
  )
}
