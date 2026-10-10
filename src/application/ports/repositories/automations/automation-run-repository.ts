/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for automation run operations
 */
export class AutomationRunDatabaseError extends Data.TaggedError('AutomationRunDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Persisted run row, matching the shape of `system.automation_runs`.
 *
 * Stored in the same schema as the engine writes, with `status` mapped
 * to the public API enum (`completed`, `failed`, `pending`, etc.) before
 * persistence.
 */
export interface PersistedRun {
  readonly id: string
  readonly automationId: string
  readonly automationName: string
  readonly status: string
  readonly triggerData: unknown
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly durationMs: number | null
  readonly error: string | null
  /** The account whose action caused the run, or `null` (the system, or an erased account). */
  readonly triggeredByUserId: string | null
  /** A person started the run by hand, so its record actions write as `triggeredByUserId`. */
  readonly startedByHand: boolean
  /** The name of the trigger entry that started the run, or `null` for a run recorded before names. */
  readonly triggerName: string | null
  /** The run that handed this one its trigger data (`RunRelay`, raw), or `null`. */
  readonly relay: unknown
  /** When the values this run captured were erased with an account (ISO 8601), or `null`. */
  readonly valuesErasedAt: string | null
  /** While the run waits on a long delay (`waiting-delay`): when it resumes (ISO 8601), else `null`. */
  readonly resumeAt: string | null
}

/**
 * Persisted step row, matching the shape of `system.automation_run_steps`.
 */
export interface PersistedStep {
  readonly id: string
  readonly runId: string
  readonly actionName: string
  readonly stepIndex: number
  readonly status: string
  readonly input: unknown
  readonly output: unknown
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly durationMs: number | null
  readonly error: string | null
  /** `context.log` entries of a code step (redacted), or `null` when it logged nothing. */
  readonly logs: unknown
  /** What the step recorded reading as it ran (`StepRead[]`, raw), or `null`. */
  readonly reads: unknown
  /** The paths or items a path or loop step ran, with their steps (raw), or `null`. */
  readonly nested: unknown
}

/**
 * Run insert payload — used by the engine after a run completes to
 * atomically persist the run plus its step rows.
 */
export interface CreateRunInput {
  readonly automationId: string
  readonly status: string
  readonly triggerData?: unknown
  /**
   * The `auth.user.id` of the person whose action caused this run. Omitted for
   * a system-initiated run (cron, `automation:call`), which lands the column as
   * SQL NULL.
   *
   * Callers MUST pass an id that exists in `auth.user` — the column carries a
   * foreign key, so the guest/system sentinels are rejected by the database.
   * Resolve raw session ids through `resolveActorUserId` before setting this.
   */
  readonly triggeredByUserId?: string
  /**
   * `triggeredByUserId` started the run by hand (see `PersistedRun.startedByHand`).
   * Kept with the run so a resume after an approval writes as the same person.
   */
  readonly startedByHand?: boolean
  /** The name of the trigger entry that started the run (`PersistedRun.triggerName`). */
  readonly triggerName?: string
  /** The run that handed this one its trigger data (`RunRelay`). Omitted for any other run. */
  readonly relay?: unknown
  readonly startedAt?: Date
  readonly completedAt?: Date
  readonly durationMs?: number
  readonly error?: string
  readonly steps?: readonly CreateStepInput[]
  /** The records the run read, by id, for the erasure index. */
  readonly refs?: readonly RunRecordRef[]
  /** The runs whose refs this run inherits — the runs its synchronous calls started. */
  readonly refsFromRuns?: readonly string[]
}

/** One record a run read: its table and its id, or `'*'` for the whole table. */
export interface RunRecordRef {
  readonly table: string
  readonly record: string
}

/**
 * Step insert payload, paired with its parent run on creation.
 */
export interface CreateStepInput {
  readonly actionName: string
  readonly stepIndex: number
  readonly status: string
  readonly input?: unknown
  readonly output?: unknown
  readonly startedAt?: Date
  readonly completedAt?: Date
  readonly durationMs?: number
  readonly error?: string
  /** Redacted `context.log` entries of a code step. */
  readonly logs?: unknown
  /** What the step recorded reading as it ran (`StepRead[]`). */
  readonly reads?: unknown
  /** The paths or items a path or loop step ran, with their steps. */
  readonly nested?: unknown
}

/**
 * Automation Run Repository Port
 *
 * Provides type-safe database operations for automation execution runs.
 * Implementation lives in infrastructure layer.
 */
/**
 * Filter / pagination options for the `listAll` reader.
 *
 * - `automationName` — restricts to runs of a single automation by user-facing name.
 * - `status` — restricts to runs in the given status (e.g. `'completed'`, `'failed'`).
 * - `page` (1-indexed) + `pageSize` — optional pagination; when omitted, all rows are returned.
 */
export interface ListRunsOptions {
  readonly automationName?: string
  readonly status?: string
  /**
   * Restrict to the runs one trigger entry started; `orUnrecorded` also keeps
   * the runs that recorded no name (those read as the automation's first entry).
   */
  readonly triggerName?: { readonly name: string; readonly orUnrecorded: boolean }
  readonly page?: number
  readonly pageSize?: number
  /** Restrict to the runs one caller may read; omitted for a caller who reads every run. */
  readonly readableBy?: RunReaderScope
}

/**
 * The runs a caller who does not read every run may read: those `userId`
 * started by hand, and those listed in `runIds` (the runs a request names them
 * an approver of). Applied in the query, so a list's total counts only them.
 */
export interface RunReaderScope {
  readonly userId: string
  readonly runIds: readonly string[]
}

/**
 * Result envelope for the `listAll` reader. `total` is the unpaginated count
 * (matching the filters); `runs` is the paginated slice.
 */
export interface ListRunsResult {
  readonly runs: readonly PersistedRun[]
  readonly total: number
}

export class AutomationRunRepository extends Context.Service<
  AutomationRunRepository,
  {
    readonly findById: (
      id: string
    ) => Effect.Effect<PersistedRun | undefined, AutomationRunDatabaseError>
    readonly listByAutomationName: (
      automationName: string,
      readableBy?: RunReaderScope
    ) => Effect.Effect<readonly PersistedRun[], AutomationRunDatabaseError>
    readonly listAll: (
      options: ListRunsOptions
    ) => Effect.Effect<ListRunsResult, AutomationRunDatabaseError>
    readonly findStepsByRunId: (
      runId: string
    ) => Effect.Effect<readonly PersistedStep[], AutomationRunDatabaseError>
    readonly create: (
      input: CreateRunInput
    ) => Effect.Effect<PersistedRun, AutomationRunDatabaseError>
    /**
     * Update the `status` column of a persisted run. Used by the cancel
     * endpoint to mark in-flight runs as
     * `'cancelled'`, and by the scheduler to promote an admitted run to
     * `'running'` — which is when `startedAt` is written: a run starts when it
     * is admitted, not when it is queued (`createdAt` keeps the enqueue
     * instant). Returns `undefined` when no row matches the id.
     */
    readonly updateStatus: (input: {
      readonly id: string
      readonly status: string
      readonly startedAt?: Date
    }) => Effect.Effect<PersistedRun | undefined, AutomationRunDatabaseError>
    /**
     * Replace the recorded `output` of one step of a run, addressed by its
     * 0-indexed position. Used when an approval the run paused on is resolved,
     * so the paused run's log reads the decision and who made it. Returns
     * whether a step row matched.
     */
    readonly recordStepOutput: (input: {
      readonly runId: string
      readonly stepIndex: number
      readonly output: unknown
    }) => Effect.Effect<boolean, AutomationRunDatabaseError>
    /**
     * Finalise a run that was previously inserted as `'queued'` / `'running'`:
     * update the terminal status + timings, optionally append step rows.
     * Used by the scheduler at the end of a run so the row id stays stable
     * across the queued → running → terminal lifecycle (the cancel endpoint
     * keeps finding the same id throughout).
     *
     * Returns the updated row (with definition name joined) or `undefined`
     * when no row matches the id.
     */
    readonly finaliseRun: (input: {
      readonly id: string
      readonly status: string
      readonly completedAt?: Date
      readonly durationMs?: number
      readonly error?: string
      readonly steps?: readonly CreateStepInput[]
      readonly refs?: readonly RunRecordRef[]
      readonly refsFromRuns?: readonly string[]
      /** A run parking on a long wait: when it resumes and where. Absent, both are cleared. */
      readonly park?: { readonly resumeAt: Date; readonly cursor: unknown }
    }) => Effect.Effect<PersistedRun | undefined, AutomationRunDatabaseError>
    /**
     * Drop what a run of a `history: 'minimal'` trigger keeps no longer once it
     * ended: its trigger data (set to NULL) and every step row. The run row —
     * status, trigger name, timings, error — stays.
     */
    readonly clearRunHistory: (runId: string) => Effect.Effect<void, AutomationRunDatabaseError>
    /**
     * Whether any run is `waiting-delay`, due or not — a probe that stops at the
     * first row, asked once per boot to decide whether the resume sweep is needed.
     */
    readonly hasWaitingDelayRuns: Effect.Effect<boolean, AutomationRunDatabaseError>
    /**
     * The `waiting-delay` runs due at `now`, oldest resume time first, at most
     * `limit` — leaving out the automations named in `exceptAutomations`, whose
     * runs stay parked without taking a place in the batch.
     */
    readonly listDueDelayedRuns: (input: {
      readonly now: Date
      readonly limit: number
      readonly exceptAutomations: readonly string[]
    }) => Effect.Effect<
      readonly { readonly id: string; readonly automationName: string }[],
      AutomationRunDatabaseError
    >
    /**
     * Claim a due `waiting-delay` run for its resume: a compare-and-set to
     * `running` that only one caller wins. Answers the run and its resume cursor,
     * or `undefined` when the run is not (or no longer) waiting and due.
     */
    readonly claimDelayedRun: (input: {
      readonly id: string
      readonly now: Date
    }) => Effect.Effect<
      { readonly run: PersistedRun; readonly cursor: unknown } | undefined,
      AutomationRunDatabaseError
    >
    /**
     * Cancel a run while it is still `waiting-delay`, with `error`: conditional,
     * so a cancel racing a resume ends in exactly one of the two. Answers
     * whether this call cancelled it.
     */
    readonly cancelWaitingRun: (input: {
      readonly id: string
      readonly error: string
    }) => Effect.Effect<boolean, AutomationRunDatabaseError>
    /**
     * Rewrite one step row of a run, addressed by its position — the loop or
     * path a resumed run completes, the wait step that gains `resumedAt`.
     */
    readonly updateStep: (input: {
      readonly runId: string
      readonly step: CreateStepInput
    }) => Effect.Effect<boolean, AutomationRunDatabaseError>
  }
>()('AutomationRunRepository') {}
