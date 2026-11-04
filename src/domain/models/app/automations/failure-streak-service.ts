/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The failure-email threshold, `automations[].notify.afterConsecutiveFailures`,
 * as pure rules over the run history — no I/O.
 *
 * An automation declaring a threshold `n` is emailed about a final failure only
 * once `n` runs in a row have ended in one. The count is read off the run
 * history, so it survives a restart:
 *
 *   - a `completed` run resets it;
 *   - a run that completed with errors neither counts nor resets (its status is
 *     not read at all);
 *   - a run the server interrupted neither counts nor resets: it is the
 *     server's event, not the automation's.
 *
 * A failure that ends a streak at least `n` long is "notifiable": the immediate
 * alert and the hourly roll-up decide about notifiable failures exactly as they
 * decide about every failure of an automation without a threshold. A failure
 * below the threshold is neither emailed nor held back.
 */

import { INTERRUPTED_RUN_ERROR, isFinalFailureStatus } from './automation-run-outcome-service'

/** One ended run, as the streak reads it. */
export interface StreakRun {
  readonly id: string
  readonly status: string
  readonly error: string | null
  readonly completedAt: Date
}

/** The statuses a streak reads: the one that resets it, and the final failures. */
export const STREAK_COUNTED_RUN_STATUSES: readonly string[] = [
  'completed',
  'failed',
  'exhausted',
  'timed-out',
]

/** How many runs, newest first, the streak reads at most. */
export const STREAK_SCAN_LIMIT = 1000

/**
 * The threshold `automationName` declares, or 1 when it declares none (every
 * final failure counts, today's behaviour).
 */
export const failureEmailThreshold = (
  automations:
    | ReadonlyArray<{
        readonly name: string
        readonly notify?: { readonly afterConsecutiveFailures?: number | undefined } | undefined
      }>
    | undefined,
  automationName: string
): number =>
  automations?.find((automation) => automation.name === automationName)?.notify
    ?.afterConsecutiveFailures ?? 1

/** Whether a run counts toward a streak, either way: interrupted runs never do. */
const countsTowardStreak = (run: StreakRun): boolean =>
  STREAK_COUNTED_RUN_STATUSES.includes(run.status) && run.error !== INTERRUPTED_RUN_ERROR

/**
 * The streak of final failures ending at the newest of `runs` (newest first):
 * how many there are, and when the first of them failed. Bounded by the runs
 * given; zero when the newest counted run is a completed one.
 */
export const leadingFailureStreak = (
  runs: readonly StreakRun[]
): { readonly length: number; readonly firstFailedAt: Date | undefined } => {
  const counted = runs.filter(countsTowardStreak)
  const end = counted.findIndex((run) => !isFinalFailureStatus(run.status))
  const streak = end === -1 ? counted : counted.slice(0, end)
  return { length: streak.length, firstFailedAt: streak.at(-1)?.completedAt }
}

/**
 * The ids of the failures among `runs` (newest first) that end a streak at
 * least `threshold` long: the failure itself and the `threshold - 1` counted
 * runs before it are all final failures. A failure too close to the oldest of
 * `runs` to tell is not notifiable.
 */
export const notifiableFailureIds = (
  runs: readonly StreakRun[],
  threshold: number
): ReadonlySet<string> => {
  const counted = runs.filter(countsTowardStreak)
  return new Set(
    counted.flatMap((run, index) => {
      const tail = counted.slice(index, index + threshold)
      return tail.length === threshold && tail.every((each) => isFinalFailureStatus(each.status))
        ? [run.id]
        : []
    })
  )
}
