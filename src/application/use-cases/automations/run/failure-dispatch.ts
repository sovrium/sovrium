/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `automation-failure` trigger fan-out for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). When a run
 * fails (or exhausts), every `automation-failure` automation whose filter
 * matches is run with a `{ body: { automationName, runId, error, … } }`
 * trigger envelope.
 *
 * `executeAutomationRun` and `resolveAutomationId` live in the orchestrator
 * (`run-automation.ts`); they are injected here as a `runners` parameter so
 * this module need not import the orchestrator (avoids an import cycle).
 */

import { Effect } from 'effect'
import { defaultActionHandlers } from '../action-handlers'
import { cryptoRandomId } from './types'
import type { TriggerData } from '../resolve-trigger-data'
import type { ExecutedStep, ResolvedRetryConfig, RunRequirements } from './types'
import type { App } from '@/domain/models/app'

/**
 * Input bag for the `automation-failure` dispatch. Shared with the
 * orchestrator's post-run failure-effects helper.
 */
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

/**
 * Orchestrator-owned run primitives injected into the failure dispatch so
 * this module need not import `run-automation.ts`. Both effects run inside
 * the {@link RunRequirements} context the dispatch already provides — the
 * `R` channel is widened to `RunRequirements` accordingly, and `E` is left
 * `unknown` because the caller wraps `resolveAutomationId` in
 * `Effect.orElseSucceed` (its error tag is irrelevant here).
 */
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

/** Select the `automation-failure` handlers whose filter matches a failed run. */
const matchingFailureHandlers = (
  app: App,
  failedAutomationName: string
): ReadonlyArray<NonNullable<App['automations']>[number]> =>
  (app.automations ?? []).filter((a) => {
    if (a.trigger.type !== 'automation-failure') return false
    const filter = a.trigger.automations
    return filter === undefined || (filter as ReadonlyArray<string>).includes(failedAutomationName)
  })

/**
 * Build the `trigger.data` envelope for an `automation-failure` handler run.
 * `attempt` = how many times the failing action ran (retryCount + 1, read
 * from the last failing step's `output.retryCount`).
 */
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

/**
 * Find every `automation-failure` automation whose filter matches a failed
 * run, and run each with `{ trigger: { data: { automationName, runId,
 * error, attempt, maxAttempts, startedAt, failedAt, triggerType } } }`.
 * Errors are swallowed — a failing run must not be re-failed by a broken
 * error handler, and an error handler's own failure does not cascade
 * (it has an `automation-failure` trigger, so `executeAutomationRun`
 * skips re-dispatch for it).
 */
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
          const automationId = yield* runners.resolveAutomationId(handler.name, handler).pipe(
            // effect-swallow: the id only LABELS this run in the activity log; a lookup that fails must not stop the automation it was about to run, and a random id keeps the run traceable within itself.
            Effect.orElseSucceed(() => cryptoRandomId())
          )
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
  }).pipe(Effect.withSpan('automations.dispatch-failure-handlers'))
