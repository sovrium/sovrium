/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatConfigRejection, isConfigRejectedError } from '@/domain/errors/config-rejected'
import {
  formatDuration,
  printJournal,
  printJournalError,
} from '@/infrastructure/logging/cli-output'
import { formatRuntimeError } from '@/infrastructure/logging/format-runtime-error'
import { publishRejectedSave, publishServerStatus } from '@/infrastructure/server/status-file'
import { snapshotConfigGraph } from './config-snapshot-history'
import type { createConfigGraphWatcher } from './config-graph-watcher'
import type { ReloadFailure, ReloadServerParams, ReloadSuccess } from './utils'
import type { StartOptions } from '@/application/use-cases/server/start-server-options'
import type { ReloadKind, ReloadOutcomeLabel } from '@/infrastructure/server/status-file'

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
 * A cheap fingerprint of what the config graph currently SAYS, as opposed
 * to when it was last touched. `fs.watch` reports writes, not edits: a
 * format-on-save rewriting identical bytes is a `change` event like any
 * other, and reloading a server for it is pure waste. Comparing this
 * against the fingerprint of the last successful reload is what makes one
 * logical save produce one reload.
 */
export const readGraphSignature = async (files: ReadonlyArray<string>): Promise<string> => {
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
/**
 * What the watcher holds between saves. Mutable on purpose: every field is
 * replaced as reloads land, and each one keeps the watcher from stranding the
 * operator.
 */
export interface WatchState {
  /** Track current server instance (mutable for watch mode). */
  currentServer: ReloadServerParams['currentServer']
  /**
   * The DECODED config the running server was built from. `reloadServer`
   * diffs the next save against it to decide whether that save can be
   * swapped into the live listener or needs a full teardown, so it must be
   * seeded from the boot and replaced after every successful reload —
   * including a hot one, where the server object itself does not change.
   */
  currentApp: ReloadServerParams['currentApp']
  /**
   * The RAW config and anchor the running server was built from. Retained
   * because they are what a rollback boots: when a restart-class save fails
   * after the listener is already down, the last-good config has to come back
   * from memory — re-reading the file would read the bad save.
   */
  currentRawApp: ReloadServerParams['currentRawApp']
  currentAnchor: ReloadServerParams['currentAnchor']
  /**
   * The files the fingerprint is taken over, and the fingerprint of the
   * config the running server was built from. `lastSignature` is replaced
   * only after a reload SUCCEEDS: if a reload fails, the last-good
   * fingerprint stays, so re-saving the same broken file reports the error
   * again instead of being mistaken for a no-op rewrite.
   */
  watchedFiles: ReadonlyArray<string>
  lastSignature: string
  /**
   * Whether the LAST ATTEMPT succeeded, which is the other half of the no-op
   * rule and the half that was missing.
   *
   * Comparing against the last-good fingerprint alone made the undo
   * unreachable: restoring the bytes that were there before a bad save
   * reproduces exactly `lastSignature`, so the save returned before it
   * announced anything — no reload, no error, no line. After a failure that
   * also took the port down, the undo is the operator's first move and it was
   * the one move the watcher ignored, turning a recoverable outage into a
   * permanent one.
   *
   * The rule that replaces it: a save is a no-op rewrite only when the last
   * attempt SUCCEEDED and its fingerprint is unchanged. After a failure the
   * next save always reloads, whatever it contains.
   */
  lastAttemptSucceeded: boolean
}

/** The fixed parts of one watch session, plus the state it mutates. */
export interface WatchContext {
  readonly configFile: string
  readonly options: StartOptions
  readonly state: WatchState
  readonly graphWatcher: ReturnType<typeof createConfigGraphWatcher>
  /**
   * Name the file that changed the way the operator sees it: relative to the
   * config directory (`config/pages.ts`), never as a `../../..` walk from an
   * unrelated cwd.
   */
  readonly describeChangedFile: (changedPath: string) => string
}

/**
 * Adopt a reload that worked: hold what it produced, and publish it.
 *
 * Split out of the scheduler's `run` so the bookkeeping and the decision to
 * do it are not read as one thing — and so the status write sits next to
 * the seven assignments it describes, rather than a screen away from them.
 */
export const commitReload = async (
  ctx: WatchContext,
  outcome: ReloadSuccess,
  save: {
    readonly signature: string
    readonly durationMs: number
    readonly kind: ReloadKind | undefined
  }
): Promise<void> => {
  const { state } = ctx
  state.currentServer = outcome.server
  state.currentApp = outcome.app
  state.currentRawApp = outcome.rawApp
  state.currentAnchor = outcome.anchor
  state.watchedFiles = outcome.files
  state.lastSignature = save.signature
  state.lastAttemptSucceeded = true
  ctx.graphWatcher.sync(outcome.files)

  // Only on this path: a refused save leaves the history untouched, because
  // an entry that never booted would be an undo target that breaks the app.
  //
  // The snapshot NAME it answers is discarded here and nowhere else: it
  // exists for `_config_write_file`, which reports it back to the AI that
  // asked for the edit. The watcher has nobody to report it to.
  await snapshotConfigGraph(ctx.configFile, outcome.files, outcome.anchor.configHash)

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
export const reportFailedReload = async (
  ctx: WatchContext,
  failure: ReloadFailure,
  announceIfSilent: (() => void) | undefined,
  save: { readonly kind: ReloadKind | undefined; readonly durationMs: number }
): Promise<void> => {
  // A save that never got as far as being classified announced nothing, and
  // a failure the operator can see explained is still a change they need
  // told about.
  announceIfSilent?.()

  // ONE call per failure, because a failure is ONE event: the printer
  // splits the text and stamps every row with the same clock and tag
  // so the cause arrives as a continuation of the sentence
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

  const { state } = ctx
  state.currentServer = failure.server
  state.lastAttemptSucceeded = false
  state.watchedFiles = unionFiles(state.watchedFiles, failure.files)
  ctx.graphWatcher.sync(state.watchedFiles)

  await publishRejectedSave({
    kind: save.kind,
    durationMs: save.durationMs,
    phase: failure.phase,
    outcome: publishedOutcome(failure),
    findings: failure.findings,
  })
}
