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
}

/**
 * Run insert payload — used by the engine after a run completes to
 * atomically persist the run plus its step rows.
 */
export interface CreateRunInput {
  readonly automationId: string
  readonly status: string
  readonly triggerData?: unknown
  readonly startedAt?: Date
  readonly completedAt?: Date
  readonly durationMs?: number
  readonly error?: string
  readonly steps?: readonly CreateStepInput[]
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
  readonly page?: number
  readonly pageSize?: number
}

/**
 * Result envelope for the `listAll` reader. `total` is the unpaginated count
 * (matching the filters); `runs` is the paginated slice.
 */
export interface ListRunsResult {
  readonly runs: readonly PersistedRun[]
  readonly total: number
}

export class AutomationRunRepository extends Context.Tag('AutomationRunRepository')<
  AutomationRunRepository,
  {
    readonly findById: (
      id: string
    ) => Effect.Effect<PersistedRun | undefined, AutomationRunDatabaseError>
    readonly listByAutomationName: (
      automationName: string
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
     * endpoint (API-AUTOMATION-RUNS-007) to mark in-flight runs as
     * `'cancelled'`. Returns `undefined` when no row matches the id.
     */
    readonly updateStatus: (input: {
      readonly id: string
      readonly status: string
    }) => Effect.Effect<PersistedRun | undefined, AutomationRunDatabaseError>
  }
>() {}
