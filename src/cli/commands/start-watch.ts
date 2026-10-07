/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname, relative, resolve } from 'node:path'
import { messageAsConfigFinding } from '@/domain/models/app/app-excess-property-report'
import { printJournal, printJournalWarning } from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { createConfigGraphWatcher } from './config-graph-watcher'
import { snapshotConfigGraph } from './config-snapshot-history'
import { createReloadScheduler } from './reload-scheduler'
import { lazyImportSchema, reloadServer } from './utils'
import { commitReload, readGraphSignature, reportFailedReload } from './watch-reload-outcome'
import type { ReloadFailure, ReloadServerParams } from './utils'
import type { WatchContext, WatchState } from './watch-reload-outcome'
import type { ConfigChangeVerdict } from '@/application/use-cases/config/classify-config-change'
import type { StartOptions } from '@/application/use-cases/server/start-server-options'
import type { ReloadKind } from '@/infrastructure/server/status-file'

/** What `sovrium start --watch` hands the watcher once the server is up. */
export interface WatchSession {
  /** Path of the config graph's root file. */
  readonly configFile: string
  /** The server the boot started. */
  readonly server: ReloadServerParams['currentServer']
  /** The raw config the boot was built from — what a rollback boots. */
  readonly app: ReloadServerParams['currentRawApp']
  readonly configHash: string
  readonly configPath: string
  readonly options: StartOptions
}

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

/** One debounced save, from fingerprint to verdict. */
const runReload = async (ctx: WatchContext, changedPath: string): Promise<void> => {
  const { state } = ctx
  const startedAt = Date.now()

  // Read the fingerprint BEFORE the reload, and commit it only once the
  // reload succeeds. Reading it afterwards would capture any edit made
  // DURING the reload — content the new server was never built from —
  // and the catch-up run would then skip it as unchanged, silently
  // losing a save. Erring the other way costs at most one extra reload.
  const signature = await readGraphSignature(state.watchedFiles)
  if (state.lastAttemptSucceeded && signature === state.lastSignature) return

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
  let announcedKind: ReloadKind | undefined
  const announce = (verdict?: ConfigChangeVerdict): void => {
    announced = true
    announcedKind = verdict?.kind
    const where = ctx.describeChangedFile(changedPath)
    printJournal(
      'watch',
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
    server: state.currentServer,
  }))

  const durationMs = Date.now() - startedAt
  if (!outcome.ok) {
    await reportFailedReload(ctx, outcome, announced ? undefined : announce, {
      kind: announcedKind,
      durationMs,
    })
    return
  }

  await commitReload(ctx, outcome, { signature, durationMs, kind: announcedKind })
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

/**
 * Watch the whole config graph of a running server and reload it on every
 * logical save, for as long as the process lives.
 */
export const watchConfigGraph = async (session: WatchSession): Promise<void> => {
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

  const rootDir = dirname(resolve(configFile))
  const reloadScheduler = createReloadScheduler({
    debounceMs: RELOAD_DEBOUNCE_MS,
    run: (changedPath) => runReload(ctx, changedPath),
  })

  // The watched set is DERIVED from the loaded config, never declared: the
  // root, every TypeScript module it imports and every file it reaches
  // through `$ref`, at any depth. It is re-derived after every successful
  // reload, because a reload can add or drop an import or a `$ref` — a newly
  // referenced file must become watched, a dropped one must stop triggering.
  const ctx: WatchContext = {
    configFile,
    options: session.options,
    state,
    graphWatcher: createConfigGraphWatcher((changedPath) => {
      reloadScheduler.schedule(changedPath)
    }),
    describeChangedFile: (changedPath) => {
      const fromRoot = relative(rootDir, changedPath)
      return fromRoot.startsWith('..') ? changedPath : fromRoot
    },
  }

  const initialFiles = await collectInitialFiles(configFile)
  ctx.graphWatcher.sync(initialFiles)

  // The boot is an accepted config, so it is snapshotted. Undo after the very
  // first edit has to land HERE — without this entry the history after one
  // change holds only the state the user is trying to leave.
  //
  // The name it answers is discarded — see the reload-path call above.
  await snapshotConfigGraph(configFile, initialFiles, state.currentAnchor.configHash)

  // Seed the change detector with what the RUNNING server was built from, so
  // the first `change` event is compared against reality rather than against
  // an empty fingerprint (which would make every first event a reload, even
  // a touch that changed nothing).
  state.watchedFiles = initialFiles
  state.lastSignature = await readGraphSignature(initialFiles)

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
