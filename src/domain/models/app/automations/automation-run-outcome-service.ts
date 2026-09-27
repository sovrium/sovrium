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
