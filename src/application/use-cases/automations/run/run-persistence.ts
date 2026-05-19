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

export const persistRun = (input: {
  readonly automationId: string
  readonly engineStatus: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
  readonly engineError: string | undefined
  readonly triggerData: TriggerData
  readonly startedAt: Date
  readonly finishedAt: Date
  readonly steps: ReadonlyArray<ExecutedStep>
}): Effect.Effect<string | undefined, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* Effect.either(
      repo.create({
        automationId: input.automationId,
        status: toApiStatus(input.engineStatus),
        triggerData: input.triggerData as unknown,
        startedAt: input.startedAt,
        completedAt: input.finishedAt,
        durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
        ...(input.engineError !== undefined ? { error: input.engineError } : {}),
        steps: input.steps.map((step, index) => ({
          actionName: step.name,
          stepIndex: index,
          status: toApiStepStatus(step.status),
          ...(step.props !== undefined ? { input: step.props as unknown } : {}),
          ...(step.output !== undefined ? { output: step.output as unknown } : {}),
          startedAt: input.startedAt,
          completedAt: input.finishedAt,
          ...(step.error !== undefined ? { error: step.error } : {}),
        })),
      })
    )
    if (result._tag === 'Left') {
      console.error('[automation] failed to persist run to DB', result.left)
      return undefined
    }
    return result.right.id
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
