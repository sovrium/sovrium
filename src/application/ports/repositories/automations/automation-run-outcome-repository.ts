/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation Run Outcome Repository Port.
 *
 * The reads and the one write behind what operators are told about how runs
 * END: closing runs a stopped server left behind, the failure history the alert
 * rules decide from, the recovery a roll-up reports, and the streak an
 * automatic pause counts. Kept apart from `AutomationRunRepository`, which is
 * the runs API's own reader and the engine's writer, because every method here
 * answers a question about a WINDOW of runs rather than about one run.
 */

import { Context, Data } from 'effect'
import type { FinalFailure } from '@/domain/models/app/automations/automation-run-outcome-service'
import type { Effect } from 'effect'

/** Database error for the run-outcome reads and the two sweeps. */
export class AutomationRunOutcomeDatabaseError extends Data.TaggedError(
  'AutomationRunOutcomeDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * How one automation's runs ended over a window — the per-automation line of
 * the weekly summary. `failed` counts every final failure (`failed`,
 * `exhausted`, `timed-out`); `timedOut` and `interrupted` are the two kinds
 * inside it an operator reads differently.
 */
export interface AutomationRunTally {
  readonly automationName: string
  readonly runs: number
  readonly failed: number
  readonly timedOut: number
  readonly interrupted: number
}

/** A run the orphan sweep or the stuck-run sweep closed. */
export interface ClosedRun {
  readonly id: string
  readonly automationName: string
}

export class AutomationRunOutcomeRepository extends Context.Service<
  AutomationRunOutcomeRepository,
  {
    /**
     * Close every run a previous server left `running` or `queued`: those
     * CREATED (triggered) before `startedBefore`, whatever their start says —
     * a run created since belongs to this server, and to the stuck-run sweep
     * if it never finishes. A run
     * waiting for an approval is never touched — its status is neither. Each
     * closed row becomes `failed` with `error` and a completion time of now.
     *
     * A run with a row in `automation_delayed_steps` still `waiting` is also
     * left alone. That guard is INERT today: nothing writes that table and
     * nothing resumes from it (a delay runs inside the run's own fiber), so no
     * such row exists. It is kept so that the day delayed steps are persisted
     * and resumed from the database, their runs are not closed by a restart.
     */
    readonly failOrphanedRuns: (input: {
      readonly startedBefore: Readonly<Date>
      readonly error: string
    }) => Effect.Effect<readonly ClosedRun[], AutomationRunOutcomeDatabaseError>

    /**
     * Close every run still `running` past its timeout — a run nothing will
     * ever finish, whose fiber died without finalising it. A run is stuck when
     * it started (or, never stamped, was created) before the cutoff of its
     * automation in `cutoffs`, or before `defaultStartedBefore` when its
     * automation is not listed there (renamed or removed from the config).
     * Each closed row becomes `timed-out` with `error`, a completion time of
     * now, and a duration measured from its start. The inert delayed-step guard
     * of {@link failOrphanedRuns} applies here too.
     */
    readonly timeOutStuckRuns: (input: {
      readonly cutoffs: ReadonlyArray<{
        readonly automationName: string
        readonly startedBefore: Readonly<Date>
      }>
      readonly defaultStartedBefore: Readonly<Date>
      readonly error: string
    }) => Effect.Effect<readonly ClosedRun[], AutomationRunOutcomeDatabaseError>

    /**
     * Every final failure (`failed`, `exhausted`, `timed-out`) completed in
     * `[from, to)`, oldest first, optionally of one automation only.
     */
    readonly listFinalFailures: (input: {
      readonly from: Readonly<Date>
      readonly to: Readonly<Date>
      readonly automationName?: string | undefined
    }) => Effect.Effect<readonly FinalFailure[], AutomationRunOutcomeDatabaseError>

    /**
     * When the first `completed` run of `automationName` finished after `after`,
     * or `undefined` when none has — the "recovered at" of a roll-up.
     */
    readonly findFirstCompletedAfter: (input: {
      readonly automationName: string
      readonly after: Readonly<Date>
    }) => Effect.Effect<Date | undefined, AutomationRunOutcomeDatabaseError>

    /**
     * The statuses of the latest runs of `automationName` that ENDED (see
     * `STREAK_TERMINAL_RUN_STATUSES`), newest first, at most `limit`, and only
     * runs started after `startedAfter` when it is given.
     */
    readonly listRecentEndedStatuses: (input: {
      readonly automationName: string
      readonly limit: number
      readonly startedAfter?: Readonly<Date> | undefined
    }) => Effect.Effect<readonly string[], AutomationRunOutcomeDatabaseError>

    /**
     * Per automation, how many runs were created in `[from, to)` and how they
     * ended — grouped in the database, one row per automation that ran.
     */
    readonly countRunsByAutomationBetween: (input: {
      readonly from: Readonly<Date>
      readonly to: Readonly<Date>
    }) => Effect.Effect<readonly AutomationRunTally[], AutomationRunOutcomeDatabaseError>

    /**
     * The error of the latest final failure of `automationName` among the runs
     * created in `[from, to)`, or `undefined` when none failed or it recorded
     * no error. Already redacted by the run store.
     */
    readonly findLastFailureError: (input: {
      readonly automationName: string
      readonly from: Readonly<Date>
      readonly to: Readonly<Date>
    }) => Effect.Effect<string | undefined, AutomationRunOutcomeDatabaseError>
  }
>()('AutomationRunOutcomeRepository') {}
