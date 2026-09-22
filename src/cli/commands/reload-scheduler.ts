/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements, functional/no-let --
 * A scheduler IS mutable state over time: a pending timer handle, an
 * in-flight flag, and the one change that arrived while a run was busy.
 * Expressing those three as anything but closure variables (a Ref, a queue
 * actor) would hide the one property this module exists to guarantee —
 * that at most one `run` is ever executing.
 */

/**
 * Coalescing scheduler for `--watch` reloads.
 *
 * `createConfigGraphWatcher` reports raw filesystem events: one editor save
 * emits several (truncate, then write), and a format-on-save emits more, some
 * of them while the reload the first event started is still awaited. Turning
 * that stream of events into "reload once per logical save, never twice at
 * the same time" is a scheduling policy, and it lives here rather than inline
 * in `start.ts` so it can be tested without a filesystem or a server.
 *
 * Two devices, for two different bursts:
 *
 *  - a DEBOUNCE window absorbs the events of a single save. `fs.watch` can
 *    fire before a write is flushed, so reloading on the first event risks
 *    reading a half-written file — surfacing as a JSON `Unexpected EOF` or an
 *    `AppSchema` decode failure. One timer covers every watched file, so a
 *    save touching two modules of the graph reloads once.
 *
 *  - a RE-ENTRANCE guard absorbs events that arrive after the window closed
 *    but while `run` is still in flight — the everyday format-on-save, which
 *    lands hundreds of milliseconds after the save it follows. A longer timer
 *    cannot fix this (the second write is simply later); only remembering
 *    that a run is busy can. However many such changes arrive, they fold into
 *    exactly ONE catch-up run, scheduled after the in-flight one settles.
 */
export interface ReloadScheduler {
  /** Record that `changedPath` changed; a run will follow, eventually, once. */
  readonly schedule: (changedPath: string) => void
}

export interface ReloadSchedulerOptions {
  /** How long to wait for a burst of events to settle before running. */
  readonly debounceMs: number
  /**
   * The work one reload performs. It is invoked with the path of the change
   * that triggered it, and MUST report its own failures: a rejection here is
   * deliberately swallowed, because a scheduler that stopped scheduling after
   * one bad reload would wedge the watcher until the operator restarted it.
   */
  readonly run: (changedPath: string) => Promise<void>
}

export const createReloadScheduler = (options: ReloadSchedulerOptions): ReloadScheduler => {
  const { debounceMs, run } = options

  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  /** The change seen while a run was in flight — at most one is remembered. */
  let pending: string | undefined

  const schedule = (changedPath: string): void => {
    // Mid-flight: do NOT arm a timer. Arming one is precisely the defect this
    // replaces — the timer fires while `run` is still awaited, so two reloads
    // overlap and the operator sees two reload lines for one save.
    if (running) {
      pending = changedPath
      return
    }
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void execute(changedPath)
    }, debounceMs)
  }

  const execute = async (changedPath: string): Promise<void> => {
    running = true
    try {
      await run(changedPath)
    } catch {
      // `run` owns its own error reporting (see ReloadSchedulerOptions.run).
    } finally {
      running = false
      const next = pending
      pending = undefined
      // The catch-up goes back through `schedule`, so it pays the same
      // debounce window. That is not ceremony: the change that set `pending`
      // may still be being written, and re-entering the window gives it the
      // same settle time a first-time change gets. It also means the catch-up
      // cannot re-trigger itself — `pending` is already cleared when it runs.
      if (next !== undefined) schedule(next)
    }
  }

  return { schedule }
}
