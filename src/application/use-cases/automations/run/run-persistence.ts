/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automation-run-repository'
import { recordAutomationRun, type AutomationRunRecord } from '../run-history-store'
import { toApiStatus, toApiStepStatus } from './run-status'
import type { ExecutedStep, RunAccumulator } from './types'
import type { TriggerData } from '../resolve-trigger-data'

export const persistQueuedRun = (input: {
  readonly automationId: string
  readonly triggerData: TriggerData
  readonly startedAt: Date
}): Effect.Effect<string | undefined, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* Effect.either(
      repo.create({
        automationId: input.automationId,
        status: 'queued',
        triggerData: input.triggerData as unknown,
        startedAt: input.startedAt,
      })
    )
    if (result._tag === 'Left') {
      console.error('[automation] failed to persist queued run row', result.left)
      return undefined
    }
    return result.right.id
  })

export const markRunRunning = (
  runId: string
): Effect.Effect<void, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* Effect.either(repo.updateStatus({ id: runId, status: 'running' }))
    if (result._tag === 'Left') {
      console.error('[automation] failed to mark run as running', result.left)
    }
  })

const buildStepsInput = (
  steps: ReadonlyArray<ExecutedStep>,
  startedAt: Readonly<Date>,
  finishedAt: Readonly<Date>
) =>
  steps.map((step, index) => ({
    actionName: step.name,
    stepIndex: index,
    status: toApiStepStatus(step.status),
    ...(step.props !== undefined ? { input: step.props as unknown } : {}),
    ...(step.output !== undefined ? { output: step.output as unknown } : {}),
    startedAt,
    completedAt: finishedAt,
    ...(step.error !== undefined ? { error: step.error } : {}),
  }))

type FinaliseRunInput = {
  readonly runId: string
  readonly automationId: string
  readonly engineStatus:
    | 'success'
    | 'failure'
    | 'timed-out'
    | 'exhausted'
    | 'completed-with-errors'
    | 'skipped'
    | 'cancelled'
    | 'queued'
    | 'running'
  readonly engineError: string | undefined
  readonly triggerData: TriggerData
  readonly startedAt: Date
  readonly finishedAt: Date
  readonly steps: ReadonlyArray<ExecutedStep>
}

const finaliseRunFallback = (input: FinaliseRunInput) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const fallback = yield* Effect.either(
      repo.create({
        automationId: input.automationId,
        status: toApiStatus(input.engineStatus),
        triggerData: input.triggerData as unknown,
        startedAt: input.startedAt,
        completedAt: input.finishedAt,
        durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
        ...(input.engineError !== undefined ? { error: input.engineError } : {}),
        steps: buildStepsInput(input.steps, input.startedAt, input.finishedAt),
      })
    )
    if (fallback._tag === 'Left') {
      console.error('[automation] failed to finalise run (fallback insert)', fallback.left)
      return undefined
    }
    return fallback.right.id
  })

export const finaliseRun = (
  input: FinaliseRunInput
): Effect.Effect<string | undefined, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const finalised = yield* Effect.either(
      repo.finaliseRun({
        id: input.runId,
        status: toApiStatus(input.engineStatus),
        completedAt: input.finishedAt,
        durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
        ...(input.engineError !== undefined ? { error: input.engineError } : {}),
        steps: buildStepsInput(input.steps, input.startedAt, input.finishedAt),
      })
    )
    if (finalised._tag === 'Left' || finalised.right === undefined) {
      console.error(
        '[automation] failed to finalise run on existing row; falling back to insert',
        finalised._tag === 'Left' ? finalised.left : 'row missing'
      )
      return yield* finaliseRunFallback(input)
    }
    return input.runId
  })

export const recordInMemoryRun = (input: {
  readonly runId: string
  readonly name: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly finalState: RunAccumulator
}): void => {
  const { runId, name, startedAt, finishedAt, finalState } = input
  const run: AutomationRunRecord = {
    id: runId,
    automationName: name,
    startedAt,
    finishedAt,
    status: finalState.runStatus,
    steps: finalState.steps,
    ...(finalState.runError !== undefined ? { error: finalState.runError } : {}),
  }
  recordAutomationRun(run)
}
