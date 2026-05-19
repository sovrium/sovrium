/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class AutomationRunDatabaseError extends Data.TaggedError('AutomationRunDatabaseError')<{
  readonly cause: unknown
}> {}

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

export interface ListRunsOptions {
  readonly automationName?: string
  readonly status?: string
  readonly page?: number
  readonly pageSize?: number
}

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
    readonly updateStatus: (input: {
      readonly id: string
      readonly status: string
    }) => Effect.Effect<PersistedRun | undefined, AutomationRunDatabaseError>
  }
>() {}
