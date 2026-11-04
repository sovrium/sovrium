/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the operator is told about how automation runs END — pure rules, no I/O.
 *
 * Three decisions live here so that the engine, the hourly roll-up and the
 * automatic pause read the same definitions:
 *
 *   - which statuses are a FINAL failure (the run will not be retried);
 *   - which final failures are emailed at once and which are held back for the
 *     hourly roll-up — decided from the data alone, so the roll-up can
 *     recompute it without anything having been recorded at send time;
 *   - when a run of final failures in a row is long enough to pause the
 *     automation.
 */

/**
 * The error a run carries when the server stopped while it was running. The
 * row is closed as `failed` rather than given a status of its own, so every
 * reader that counts failures already counts it.
 */
export const INTERRUPTED_RUN_ERROR = 'Interrupted: the server stopped during this run'

/**
 * The error a run carries when the engine itself failed during it — an
 * unexpected defect rather than an action that failed — and the run was closed
 * as `failed` so it does not stay `running` for good.
 */
export const RUN_DEFECT_ERROR = 'The run stopped with an internal error'

/**
 * The error a run carries when the periodic sweep found it still `running` a
 * minute past its timeout — a run nothing will finish — and closed it as
 * `timed-out`. Deliberately distinct from {@link INTERRUPTED_RUN_ERROR}: the
 * weekly summary counts interrupted runs by matching that exact string, and a
 * stuck run is a timeout, not an interruption.
 */
export const STUCK_RUN_ERROR = 'Timed out: the run exceeded its timeout and was closed by the sweep'

/** How many runs of one automation a restart interrupted. */
export interface InterruptedRunCount {
  readonly name: string
  readonly runs: number
}

/**
 * Count the runs a restart closed, per automation, sorted by name — the lines
 * of the one email a restart sends, however many runs it interrupted.
 */
export const countInterruptedRuns = (
  closed: ReadonlyArray<{ readonly automationName: string }>
): readonly InterruptedRunCount[] => {
  const names = [...new Set(closed.map((run) => run.automationName))].toSorted()
  return names.map((name) => ({
    name,
    runs: closed.filter((run) => run.automationName === name).length,
  }))
}

/** The statuses a run ends on when it failed for good. */
export const FINAL_FAILURE_RUN_STATUSES: readonly string[] = ['failed', 'exhausted', 'timed-out']

/**
 * The statuses that END a run, for counting a streak. `skipped` and `cancelled`
 * say nothing about whether the automation works, and a run waiting for an
 * approval has not ended, so none of them breaks or extends a streak.
 */
export const STREAK_TERMINAL_RUN_STATUSES: readonly string[] = [
  'completed',
  'completed-with-errors',
  'failed',
  'exhausted',
  'timed-out',
]

/** The reason the platform records on a pause it set itself. */
export const AUTO_PAUSE_REASON = 'consecutive-failures'

/** How long after a failure its automation's next failures are held back. */
export const FAILURE_ALERT_WINDOW_MS = 60 * 60 * 1000

/** The longest error line a roll-up prints for one automation. */
const ROLLUP_ERROR_MAX_LENGTH = 200

/** Whether a run status is a final failure. */
export const isFinalFailureStatus = (status: string): boolean =>
  FINAL_FAILURE_RUN_STATUSES.includes(status)

/** Whose fault a failed run is: the engine's (`defect`), or one of its own steps' (`step`). */
export type RunFailureKind = 'defect' | 'step'

/**
 * Whose fault a run's failure is, read off its status and whether the engine
 * recorded a defect on it — the same field the run report read answers from.
 * `undefined` for a run that did not fail for good: there is no failure to
 * attribute.
 */
export const runFailureKindOf = (
  status: string | null,
  hasDefect: boolean
): RunFailureKind | undefined => {
  if (status === null || !isFinalFailureStatus(status)) return undefined
  return hasDefect ? 'defect' : 'step'
}

/** One final failure, as the alert rules read it. */
export interface FinalFailure {
  readonly id: string
  readonly automationName: string
  readonly completedAt: Date
  readonly error: string | null
}

/**
 * Whether `failure` is emailed at once: true when no OTHER final failure of the
 * same automation completed in the hour before it (inclusive of the same
 * instant). A failure that is not emailed at once is held back for the roll-up.
 */
export const qualifiesForImmediateAlert = (
  failure: FinalFailure,
  others: readonly FinalFailure[]
): boolean => {
  const windowStart = failure.completedAt.getTime() - FAILURE_ALERT_WINDOW_MS
  return !others.some(
    (other) =>
      other.id !== failure.id &&
      other.automationName === failure.automationName &&
      other.completedAt.getTime() >= windowStart &&
      other.completedAt.getTime() <= failure.completedAt.getTime()
  )
}

/**
 * The failures a roll-up reports: those completed in `[from, to)` that were
 * held back. `failures` must reach at least one hour before `from`, so a
 * failure early in the window can see the one that was emailed before it.
 *
 * An interrupted run is never held back: it is the server's event rather than
 * the automation's, and its alert is always sent at once.
 */
export const selectHeldBackFailures = (
  failures: readonly FinalFailure[],
  from: Readonly<Date>,
  to: Readonly<Date>
): readonly FinalFailure[] =>
  failures.filter(
    (failure) =>
      failure.completedAt.getTime() >= from.getTime() &&
      failure.completedAt.getTime() < to.getTime() &&
      failure.error !== INTERRUPTED_RUN_ERROR &&
      !qualifiesForImmediateAlert(failure, failures)
  )

/** An error reduced to what a roll-up prints: its first line, at most 200 characters. */
export const rollupErrorLine = (error: string | null): string => {
  const firstLine = (error ?? '').split('\n')[0]?.trim() ?? ''
  if (firstLine === '') return 'No error message was recorded.'
  return firstLine.length <= ROLLUP_ERROR_MAX_LENGTH
    ? firstLine
    : `${firstLine.slice(0, ROLLUP_ERROR_MAX_LENGTH - 1)}…`
}

/** One automation's line in the roll-up, before its recovery is looked up. */
export interface RollupGroup {
  readonly name: string
  readonly extraFailures: number
  readonly lastError: string
  readonly lastFailedAt: Date
}

/** Group held-back failures per automation, sorted by name. */
export const groupHeldBackFailures = (held: readonly FinalFailure[]): readonly RollupGroup[] => {
  const names = [...new Set(held.map((failure) => failure.automationName))].toSorted()
  return names.flatMap((name) => {
    const ofName = held
      .filter((failure) => failure.automationName === name)
      .toSorted((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
    const last = ofName.at(-1)
    return last === undefined
      ? []
      : [
          {
            name,
            extraFailures: ofName.length,
            lastError: rollupErrorLine(last.error),
            lastFailedAt: last.completedAt,
          },
        ]
  })
}

/**
 * Whether the latest runs of an automation are `threshold` final failures in a
 * row. `statuses` is newest first and already limited to runs that ended (see
 * {@link STREAK_TERMINAL_RUN_STATUSES}) since the last resume; fewer than
 * `threshold` of them is not a streak yet.
 */
export const isFailureStreak = (statuses: readonly string[], threshold: number): boolean =>
  threshold >= 1 &&
  statuses.length >= threshold &&
  statuses.slice(0, threshold).every((status) => isFinalFailureStatus(status))

// ── The hold-back the server keeps in memory ─────────────────────────────────
//
// The rules above read the run history. A database that refuses writes — a
// full disk, a read-only file — leaves no row to read, so every failure would
// look like the first of its hour. The server therefore keeps, per automation,
// when it last sent an immediate alert and what it has held back since. It is
// consulted only for a failure the history does not hold: when the history
// recorded the failure, the history decides exactly as before, and the roll-up
// counts it from there.

/** How many automations the in-memory hold-back tracks at once. */
export const HOLD_BACK_MAX_AUTOMATIONS = 500

/** Held-back failures, counted rather than listed so the state stays bounded. */
export interface HeldBackTally {
  readonly extraFailures: number
  readonly lastError: string
  readonly lastFailedAt: Date
}

/** What the server remembers about one automation's alerts. */
export interface HoldBackEntry {
  readonly lastAlertAt: Date | undefined
  readonly held: HeldBackTally | undefined
}

/**
 * The in-memory hold-back. `overflow` counts the failures of automations it
 * had no room to track: they are never emailed at once, and the next roll-up
 * reports them in one line.
 *
 * `alerted` names the runs whose failure was emailed at once (run id → when it
 * failed), so a roll-up never counts one again even when the history, read
 * later, would place it on the other side of the hour boundary. `recoveries`
 * holds, per automation, the first success the server saw since its last
 * failure: a trigger that keeps no row of a success still recovered. Both
 * keep one hour, the span a roll-up reads them over.
 */
export interface HoldBackState {
  readonly entries: ReadonlyMap<string, HoldBackEntry>
  readonly overflow: HeldBackTally | undefined
  readonly alerted: ReadonlyMap<string, Date>
  readonly recoveries: ReadonlyMap<string, Date>
}

export const EMPTY_HOLD_BACK: HoldBackState = {
  entries: new Map(),
  overflow: undefined,
  alerted: new Map(),
  recoveries: new Map(),
}

/** Keep the instants of a map that fall in the hour up to `at`, at most the tracking bound. */
const keepLastHour = (
  instants: ReadonlyMap<string, Date>,
  at: Readonly<Date>
): ReadonlyMap<string, Date> =>
  new Map(
    [...instants]
      .filter(([, instant]) => at.getTime() - instant.getTime() <= FAILURE_ALERT_WINDOW_MS)
      .slice(-HOLD_BACK_MAX_AUTOMATIONS)
  )

/**
 * Remember that a run of `automationName` succeeded at `at`. Only the first
 * success since its last failure is kept: that is when it recovered.
 */
export const recordRunSuccess = (
  state: HoldBackState,
  automationName: string,
  at: Readonly<Date>
): HoldBackState =>
  state.recoveries.has(automationName)
    ? state
    : {
        ...state,
        recoveries: keepLastHour(new Map([...state.recoveries, [automationName, at]]), at),
      }

/**
 * When an automation recovered after `lastFailedAt`: the earliest success after
 * it, of the one the history recorded and the one the server saw.
 */
export const firstRecoveryAfter = (
  lastFailedAt: Readonly<Date>,
  candidates: ReadonlyArray<Readonly<Date> | undefined>
): Readonly<Date> | undefined =>
  candidates
    .filter((at): at is Readonly<Date> => at !== undefined && at.getTime() > lastFailedAt.getTime())
    .toSorted((a, b) => a.getTime() - b.getTime())[0]

/** Note a decision: an immediate alert is remembered, and any failure ends a recovery. */
const noteDecision = (outcome: HoldBackOutcome, failure: FinalFailure): HoldBackOutcome => {
  const { state } = outcome
  const recoveries = new Map(
    [...state.recoveries].filter(([name]) => name !== failure.automationName)
  )
  const alerted =
    outcome.decision === 'immediate'
      ? keepLastHour(
          new Map([...state.alerted, [failure.id, failure.completedAt]]),
          failure.completedAt
        )
      : state.alerted
  return { decision: outcome.decision, state: { ...state, alerted, recoveries } }
}

/** How one final failure is told: emailed now, or held back for the roll-up. */
export type HoldBackDecision = 'immediate' | 'held'

const addToTally = (
  tally: Readonly<HeldBackTally> | undefined,
  failure: Readonly<FinalFailure>
): HeldBackTally => {
  const latest = tally === undefined || failure.completedAt >= tally.lastFailedAt
  return {
    extraFailures: (tally?.extraFailures ?? 0) + 1,
    lastError: latest ? rollupErrorLine(failure.error) : tally.lastError,
    lastFailedAt: latest ? failure.completedAt : tally.lastFailedAt,
  }
}

/** Whether `at` falls in the hour after `alertAt`. */
const withinAlertWindow = (alertAt: Readonly<Date> | undefined, at: Readonly<Date>): boolean =>
  alertAt !== undefined &&
  at.getTime() >= alertAt.getTime() &&
  at.getTime() - alertAt.getTime() <= FAILURE_ALERT_WINDOW_MS

/** Drop the entries that hold nothing back and whose alert window has closed. */
const pruneEntries = (
  entries: ReadonlyMap<string, HoldBackEntry>,
  at: Readonly<Date>
): ReadonlyMap<string, HoldBackEntry> =>
  new Map(
    [...entries].filter(
      ([, entry]) => entry.held !== undefined || withinAlertWindow(entry.lastAlertAt, at)
    )
  )

const withEntry = (
  state: HoldBackState,
  entries: ReadonlyMap<string, HoldBackEntry>,
  name: string,
  entry: HoldBackEntry
): HoldBackState => ({ ...state, entries: new Map([...entries, [name, entry]]) })

/**
 * Decide whether `failure` is emailed at once, and return the hold-back as it
 * stands after it.
 *
 * `history` is the automation's final failures of the hour up to `failure`, as
 * the database answered — `undefined` when it could not be read.
 *
 *   - The history holds `failure` itself: the history decides, unchanged. An
 *     immediate alert is still remembered, so a later failure the database
 *     refuses to record is held back behind it.
 *   - It does not: the failure is held when the server sent an immediate alert
 *     for this automation in the hour before it, or when the history shows an
 *     earlier failure of that hour; otherwise it is emailed and remembered.
 *     A held failure is counted for the next roll-up.
 *   - No room to track a new automation: its unrecorded failure joins the
 *     overflow, held rather than emailed, so the emails stay bounded too.
 */
export const decideHoldBack = (
  state: HoldBackState,
  failure: FinalFailure,
  history: readonly FinalFailure[] | undefined
): HoldBackOutcome => noteDecision(decideAlert(state, failure, history), failure)

const decideAlert = (
  state: HoldBackState,
  failure: FinalFailure,
  history: readonly FinalFailure[] | undefined
): HoldBackOutcome => {
  const entries = pruneEntries(state.entries, failure.completedAt)
  const historyImmediate = history === undefined || qualifiesForImmediateAlert(failure, history)
  const recorded = history?.some((other) => other.id === failure.id) ?? false
  if (recorded && !historyImmediate) return { decision: 'held', state: { ...state, entries } }
  const pruned = { ...state, entries }
  const tracked = entries.has(failure.automationName) || entries.size < HOLD_BACK_MAX_AUTOMATIONS
  if (!tracked) return untrackedOutcome(pruned, failure, recorded)
  return trackedOutcome(pruned, failure, recorded || historyImmediate, recorded)
}

/** A decision and the hold-back as it stands after it. */
interface HoldBackOutcome {
  readonly decision: HoldBackDecision
  readonly state: HoldBackState
}

/** No room for a new automation: recorded failures follow the history, the rest overflow. */
const untrackedOutcome = (
  state: HoldBackState,
  failure: FinalFailure,
  recorded: boolean
): HoldBackOutcome =>
  recorded
    ? { decision: 'immediate', state }
    : { decision: 'held', state: { ...state, overflow: addToTally(state.overflow, failure) } }

/**
 * A tracked automation: emailed when the history allows it and, for a failure
 * the history did not record, no alert of the server's own went out in the hour
 * before it; otherwise counted for the roll-up.
 */
const trackedOutcome = (
  state: HoldBackState,
  failure: FinalFailure,
  historyAllows: boolean,
  recorded: boolean
): HoldBackOutcome => {
  const name = failure.automationName
  const entry = state.entries.get(name)
  const immediate =
    recorded || (historyAllows && !withinAlertWindow(entry?.lastAlertAt, failure.completedAt))
  return immediate
    ? {
        decision: 'immediate',
        state: withEntry(state, state.entries, name, {
          lastAlertAt: failure.completedAt,
          held: entry?.held,
        }),
      }
    : {
        decision: 'held',
        state: withEntry(state, state.entries, name, {
          lastAlertAt: entry?.lastAlertAt,
          held: addToTally(entry?.held, failure),
        }),
      }
}

/** What a roll-up takes out of the in-memory hold-back. */
export interface TakenHoldBack {
  readonly groups: readonly RollupGroup[]
  readonly overflow: HeldBackTally | undefined
  /** The runs emailed at once: never counted by a roll-up, whatever the history says. */
  readonly alerted: ReadonlySet<string>
  /** The first success the server saw per automation since its last failure. */
  readonly recoveries: ReadonlyMap<string, Date>
  readonly state: HoldBackState
}

/**
 * Take every failure the hold-back counted, as roll-up groups sorted by name,
 * and forget them: a roll-up reports a held-back failure once. The alert
 * instants, the alerted runs and the recoveries stay, so the hour after an
 * alert keeps holding back and a later roll-up still reads them.
 */
export const takeHeldBack = (state: HoldBackState): TakenHoldBack => {
  const groups = [...state.entries]
    .flatMap(([name, entry]): readonly RollupGroup[] =>
      entry.held === undefined ? [] : [{ name, ...entry.held }]
    )
    .toSorted((a, b) => a.name.localeCompare(b.name))
  const entries = new Map(
    [...state.entries].map(([name, entry]): readonly [string, HoldBackEntry] => [
      name,
      { lastAlertAt: entry.lastAlertAt, held: undefined },
    ])
  )
  return {
    groups,
    overflow: state.overflow,
    alerted: new Set(state.alerted.keys()),
    recoveries: state.recoveries,
    state: { ...state, entries, overflow: undefined },
  }
}

/**
 * Merge the roll-up groups read from the history with those the in-memory
 * hold-back counted, one line per automation, sorted by name. The two never
 * count the same failure: the hold-back counts only failures the history did
 * not record.
 */
export const mergeRollupGroups = (
  fromHistory: readonly RollupGroup[],
  fromMemory: readonly RollupGroup[]
): readonly RollupGroup[] => {
  const all = [...fromHistory, ...fromMemory]
  const names = [...new Set(all.map((group) => group.name))].toSorted()
  return names.flatMap((name) => {
    const ofName = all
      .filter((group) => group.name === name)
      .toSorted((a, b) => a.lastFailedAt.getTime() - b.lastFailedAt.getTime())
    const last = ofName.at(-1)
    return last === undefined
      ? []
      : [
          {
            name,
            extraFailures: ofName.reduce((sum, group) => sum + group.extraFailures, 0),
            lastError: last.lastError,
            lastFailedAt: last.lastFailedAt,
          },
        ]
  })
}
