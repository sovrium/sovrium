/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { defaultActionHandlers } from '../action-handlers'
import { cryptoRandomId } from './types'
import type { TriggerData } from '../resolve-trigger-data'
import type { ExecutedStep, ResolvedRetryConfig, RunRequirements } from './types'
import type { App } from '@/domain/models/app'

export interface DispatchFailureHandlersInput {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly failedAutomationName: string
  readonly failedTriggerType: string
  readonly runId: string
  readonly error: string
  readonly steps: ReadonlyArray<ExecutedStep>
  readonly retryConfig: ResolvedRetryConfig | undefined
  readonly startedAt: string
  readonly failedAt: string
}

export interface FailureDispatchRunners {
  readonly resolveAutomationId: (
    name: string,
    automation: NonNullable<App['automations']>[number]
  ) => Effect.Effect<string, unknown, RunRequirements>
  readonly executeAutomationRun: (input: {
    readonly name: string
    readonly automation: NonNullable<App['automations']>[number]
    readonly automationId: string
    readonly app: App
    readonly processEnv: Readonly<Record<string, string | undefined>>
    readonly triggerData: TriggerData
    readonly handlers: typeof defaultActionHandlers
    readonly userId: string | undefined
  }) => Effect.Effect<unknown, never, RunRequirements>
}

const matchingFailureHandlers = (
  app: App,
  failedAutomationName: string
): ReadonlyArray<NonNullable<App['automations']>[number]> =>
  (app.automations ?? []).filter((a) => {
    if (a.trigger.type !== 'automation-failure') return false
    const filter = a.trigger.automations
    return filter === undefined || (filter as ReadonlyArray<string>).includes(failedAutomationName)
  })

const buildFailureTriggerData = (input: DispatchFailureHandlersInput): TriggerData => {
  const lastFailingStep = input.steps.findLast((s) => s.status === 'failure')
  const retryCount =
    typeof lastFailingStep?.output?.['retryCount'] === 'number'
      ? (lastFailingStep.output['retryCount'] as number)
      : 0
  return {
    body: {
      automationName: input.failedAutomationName,
      runId: input.runId,
      error: input.error,
      attempt: retryCount + 1,
      maxAttempts: input.retryConfig?.maxAttempts ?? 1,
      startedAt: input.startedAt,
      failedAt: input.failedAt,
      triggerType: input.failedTriggerType,
    },
  }
}

export const dispatchFailureHandlers = (
  input: DispatchFailureHandlersInput,
  runners: FailureDispatchRunners
): Effect.Effect<void, never, RunRequirements> =>
  Effect.gen(function* () {
    const handlers = matchingFailureHandlers(input.app, input.failedAutomationName)
    if (handlers.length === 0) return
    const failureTriggerData = buildFailureTriggerData(input)
    yield* Effect.forEach(
      handlers,
      (handler) =>
        Effect.gen(function* () {
          const automationId = yield* runners
            .resolveAutomationId(handler.name, handler)
            .pipe(Effect.orElseSucceed(() => cryptoRandomId()))
          yield* runners.executeAutomationRun({
            name: handler.name,
            automation: handler,
            automationId,
            app: input.app,
            processEnv: input.processEnv,
            triggerData: failureTriggerData,
            handlers: defaultActionHandlers,
            userId: undefined,
          })
        }),
      { concurrency: 1 }
    )
  })
