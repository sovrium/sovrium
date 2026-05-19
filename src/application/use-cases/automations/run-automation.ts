/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Duration, Effect } from 'effect'
import {
  AutomationRepository,
  type AutomationDatabaseError,
} from '@/application/ports/repositories/automation-repository'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import { expandRefActions, type ActionTemplateLike } from './expand-action-refs'
import { notifyPlatformFailure } from './notify-platform-failure'
import { buildEnvLookup } from './resolve-env-vars'
import { buildAutomationContext, type TriggerData } from './resolve-trigger-data'
import { buildAutomationInvoker } from './run/automation-call-invoker'
import { dispatchFailureHandlers } from './run/failure-dispatch'
import { persistRun, recordInMemoryRun } from './run/run-persistence'
import { appendSkippedStep, executeStep } from './run/step-executor'
import {
  EMPTY_RUN_ACCUMULATOR,
  cryptoRandomId,
  isTerminalFailureStatus,
  toResolvedRetry,
  type ExecuteAutomationRunInput,
  type RunAccumulator,
  type RunAutomationResult,
  type RunRequirements,
  type StepContext,
  type StepRequirements,
} from './run/types'
import type { App } from '@/domain/models/app'

export type RunAutomationError =
  | { readonly _tag: 'AutomationNotFound'; readonly name: string }
  | { readonly _tag: 'AutomationNotWebhookTriggered'; readonly name: string }
  | { readonly _tag: 'AutomationNotManualTriggered'; readonly name: string }
  | {
      readonly _tag: 'AutomationManualRoleRequired'
      readonly name: string
      readonly required: string
    }
  | { readonly _tag: 'AutomationRegistrySeedError'; readonly name: string; readonly cause: unknown }


export { MAX_ERROR_LENGTH, truncateError, type ExecuteAutomationRunInput } from './run/types'
export type { ExecutedStep, RunAutomationResult } from './run/types'

export type ExecuteAutomationRunRequirements = RunRequirements

export interface RunWebhookAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId?: string
}

const resolveWebhookAutomation = (
  app: App,
  name: string
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.enabled === false)
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.trigger.type !== 'webhook') {
    return Effect.fail({ _tag: 'AutomationNotWebhookTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

const expandAutomationActions = (
  app: App,
  automation: NonNullable<App['automations']>[number]
): readonly Record<string, unknown>[] =>
  expandRefActions(
    automation.actions as readonly unknown[] as readonly Record<string, unknown>[],
    (app.actions ?? []) as readonly unknown[] as ReadonlyArray<ActionTemplateLike>
  ) as readonly Record<string, unknown>[]

export const resolveAutomationId = (
  name: string,
  automation: NonNullable<App['automations']>[number]
): Effect.Effect<string, RunAutomationError, AutomationRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRepository
    const seedFailed = (cause: Readonly<AutomationDatabaseError>) =>
      ({ _tag: 'AutomationRegistrySeedError' as const, name, cause }) satisfies RunAutomationError

    const existing = yield* repo.findByName(name).pipe(Effect.mapError(seedFailed))
    if (existing !== undefined && typeof existing['id'] === 'string') {
      return existing['id']
    }

    const created = yield* repo
      .create({
        name,
        trigger: automation.trigger as unknown as Record<string, unknown>,
        actions: automation.actions as unknown as readonly Record<string, unknown>[],
        enabled: automation.enabled ?? true,
      })
      .pipe(Effect.mapError(seedFailed))
    if (typeof created['id'] !== 'string') {
      return yield* Effect.fail({
        _tag: 'AutomationRegistrySeedError' as const,
        name,
        cause: new Error('AutomationRepository.create returned a row without an id'),
      } satisfies RunAutomationError)
    }
    return created['id']
  })

const buildStepContext = (input: {
  readonly name: string
  readonly automationId: string
  readonly app: App
  readonly automation: NonNullable<App['automations']>[number]
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  readonly callDepth?: number
  readonly visitedAutomations?: ReadonlySet<string>
}): StepContext => {
  const { name, automationId, app, automation, processEnv, triggerData, handlers, userId } = input
  const callDepth = input.callDepth ?? 0
  const visited = input.visitedAutomations ?? new Set<string>()
  return {
    app,
    envLookup: buildEnvLookup(app.env, processEnv),
    processEnv,
    handlers,
    templateContext: buildAutomationContext(triggerData),
    automation: { name, id: automationId, ...(userId !== undefined ? { userId } : {}) },
    triggerData: triggerData as Readonly<Record<string, unknown>>,
    automationRetry: toResolvedRetry(automation.retry),
    callDepth,
    visitedAutomations: new Set([...visited, name]),
  }
}

const buildRunResult = (runId: string, finalState: RunAccumulator): RunAutomationResult => ({
  runId,
  status: finalState.runStatus,
  actions: finalState.actions,
  ...(finalState.lastOutput !== undefined ? { lastOutput: finalState.lastOutput } : {}),
  ...(finalState.runError !== undefined ? { error: finalState.runError } : {}),
  ...(finalState.responseOverride !== undefined
    ? { responseOverride: finalState.responseOverride }
    : {}),
  ...(finalState.returnData !== undefined ? { returnData: finalState.returnData } : {}),
})

const resolveRunTimeoutMs = (
  automation: NonNullable<App['automations']>[number]
): number | undefined => {
  const raw = (automation as { readonly timeout?: number }).timeout
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined
}

const runActionsWithTimeout = (
  rawActions: readonly Record<string, unknown>[],
  ctx: StepContext,
  timeoutMs: number | undefined,
  skipActionNames: ReadonlySet<string>
): Effect.Effect<RunAccumulator, never, StepRequirements> => {
  const loop = Effect.reduce(rawActions, EMPTY_RUN_ACCUMULATOR, (acc, rawAction) => {
    if (acc.halted) return Effect.succeed(acc)
    if (isTerminalFailureStatus(acc.runStatus))
      return Effect.succeed(appendSkippedStep(acc, rawAction))
    if (skipActionNames.has(String(rawAction['name'] ?? ''))) {
      return Effect.succeed(appendSkippedStep(acc, rawAction))
    }
    return executeStep(acc, rawAction, ctx, boundAutomationInvoker)
  })
  if (timeoutMs === undefined) return loop
  return Effect.timeoutTo(loop, {
    duration: Duration.millis(timeoutMs),
    onSuccess: (final): RunAccumulator => final,
    onTimeout: (): RunAccumulator => ({
      ...EMPTY_RUN_ACCUMULATOR,
      runStatus: 'timed-out',
      runError: `automation run exceeded timeout of ${String(timeoutMs)}ms`,
    }),
  })
}

export const executeAutomationRun = (
  input: ExecuteAutomationRunInput
): Effect.Effect<RunAutomationResult, never, RunRequirements> =>
  Effect.gen(function* () {
    const { name, automation, automationId, app, processEnv, triggerData } = input
    const startedAtDate = new Date()
    const ctx = buildStepContext(input)
    const rawActions = expandAutomationActions(app, automation)
    const runTimeoutMs = resolveRunTimeoutMs(automation)
    const skipActionNames = input.skipActionNames ?? new Set<string>()

    const finalState = yield* runActionsWithTimeout(rawActions, ctx, runTimeoutMs, skipActionNames)

    const finishedAtDate = new Date()

    const persistedRunId = yield* persistRun({
      automationId,
      engineStatus: finalState.runStatus,
      engineError: finalState.runError,
      triggerData,
      startedAt: startedAtDate,
      finishedAt: finishedAtDate,
      steps: finalState.steps,
    })

    const runId = persistedRunId ?? cryptoRandomId()
    recordInMemoryRun({
      runId,
      name,
      startedAt: startedAtDate.toISOString(),
      finishedAt: finishedAtDate.toISOString(),
      finalState,
    })

    yield* dispatchPostRunFailureEffects({
      app,
      processEnv,
      automation,
      name,
      runId,
      finalState,
      startedAtDate,
      finishedAtDate,
    })

    return buildRunResult(runId, finalState)
  })

const boundAutomationInvoker = buildAutomationInvoker({
  resolveAutomationId,
  executeAutomationRun,
})

const dispatchPostRunFailureEffects = (input: {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly automation: NonNullable<App['automations']>[number]
  readonly name: string
  readonly runId: string
  readonly finalState: RunAccumulator
  readonly startedAtDate: Date
  readonly finishedAtDate: Date
}): Effect.Effect<void, never, RunRequirements> =>
  Effect.gen(function* () {
    const { app, processEnv, automation, name, runId, finalState } = input
    const shouldCascadeFailure =
      (finalState.runStatus === 'failure' || finalState.runStatus === 'exhausted') &&
      automation.trigger.type !== 'automation-failure'
    if (!shouldCascadeFailure) return
    yield* dispatchFailureHandlers(
      {
        app,
        processEnv,
        failedAutomationName: name,
        failedTriggerType: automation.trigger.type,
        runId,
        error: finalState.runError ?? 'Automation failed',
        steps: finalState.steps,
        retryConfig: toResolvedRetry(automation.retry),
        startedAt: input.startedAtDate.toISOString(),
        failedAt: input.finishedAtDate.toISOString(),
      },
      { resolveAutomationId, executeAutomationRun }
    )
    yield* notifyPlatformFailure({
      app,
      automationName: name,
      runId,
      error: finalState.runError ?? 'Automation failed',
      failedAt: input.finishedAtDate.toISOString(),
    })
  })

export const runWebhookAutomation = ({
  name,
  app,
  processEnv,
  triggerData = {},
  handlers = defaultActionHandlers,
  userId,
}: RunWebhookAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  RunRequirements
> =>
  Effect.gen(function* () {
    const automation = yield* resolveWebhookAutomation(app, name)
    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers,
      userId,
    })
  })

