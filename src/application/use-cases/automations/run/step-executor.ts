/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Duration, Effect } from 'effect'
import {
  actionKey,
  noopActionHandler,
  type ActionHandler,
  type ActionOutcome,
} from '../action-handlers'
import { redactSecretsForApp } from '../redact-secrets'
import { resolveEnvInValue } from '../resolve-env-vars'
import { resolveTriggerInValue } from '../resolve-trigger-data'
import { buildNativeActionInvoker, buildTemplateInvoker } from './action-invokers'
import {
  resolveRetryForAction,
  retryDelayMs,
  sleepEffect,
  truncateError,
  type AutomationInvoker,
  type ExecutedStep,
  type ResolvedRetryConfig,
  type RunAccumulator,
  type StepContext,
  type StepRequirements,
} from './types'
import type { App } from '@/domain/models/app'

const connectionsForRedaction = (
  app: App
): ReadonlyArray<Readonly<Record<string, unknown>>> | undefined =>
  app.connections as unknown as ReadonlyArray<Readonly<Record<string, unknown>>> | undefined

const redactString = (
  input: string,
  app: App,
  env: Readonly<Record<string, string | undefined>>
): string => {
  const redacted = redactSecretsForApp(input, app.env, env, connectionsForRedaction(app))
  return truncateError(typeof redacted === 'string' ? redacted : input)
}

const buildStep = (
  rawAction: Readonly<Record<string, unknown>>,
  resolvedProps: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome,
  ctx: StepContext
): ExecutedStep => {
  const stepOperator = rawAction['operator'] as string | undefined
  const redactedProps = redactSecretsForApp(
    resolvedProps,
    ctx.app.env,
    ctx.processEnv,
    connectionsForRedaction(ctx.app)
  ) as Record<string, unknown>

  const stepStatus: 'success' | 'failure' | 'filtered' =
    outcome.status === 'failure'
      ? 'failure'
      : outcome.status === 'filtered'
        ? 'filtered'
        : 'success'
  return {
    name: String(rawAction['name'] ?? ''),
    type: String(rawAction['type'] ?? ''),
    ...(stepOperator !== undefined ? { operator: stepOperator } : {}),
    status: stepStatus,
    ...(outcome.error !== undefined
      ? { error: redactString(outcome.error, ctx.app, ctx.processEnv) }
      : {}),
    props: redactedProps,
    ...(outcome.output !== undefined ? { output: outcome.output as Record<string, unknown> } : {}),
  }
}

const resolveActionTimeoutMs = (action: Readonly<Record<string, unknown>>): number | undefined => {
  const raw = action['timeout']
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined
}

const withActionTimeout = (
  invocation: Effect.Effect<ActionOutcome, never, StepRequirements>,
  timeoutMs: number | undefined,
  action: Readonly<Record<string, unknown>>
): Effect.Effect<ActionOutcome, never, StepRequirements> => {
  if (timeoutMs === undefined) return invocation
  const stepName = String(action['name'] ?? 'action')
  return Effect.timeoutTo(invocation, {
    duration: Duration.millis(timeoutMs),
    onSuccess: (outcome): ActionOutcome => outcome,
    onTimeout: (): ActionOutcome => ({
      status: 'failure',
      error: `action '${stepName}' timed out after ${String(timeoutMs)}ms`,
    }),
  })
}

interface AttemptRecord {
  readonly attemptNumber: number
  readonly timestamp: string
  readonly error?: string
}

interface RetryReducerState {
  readonly outcome: ActionOutcome
  readonly retryCount: number
  readonly attempts: ReadonlyArray<AttemptRecord>
}

const buildAttemptRecord = (outcome: ActionOutcome, attemptNumber: number): AttemptRecord => ({
  attemptNumber,
  timestamp: new Date().toISOString(),
  ...(outcome.error !== undefined ? { error: outcome.error } : {}),
})

const stepRetry = (
  state: RetryReducerState,
  retryIndex: number,
  retry: ResolvedRetryConfig,
  invoke: (attempt: number) => Effect.Effect<ActionOutcome, never, StepRequirements>
): Effect.Effect<RetryReducerState, never, StepRequirements> =>
  state.outcome.status !== 'failure'
    ? Effect.succeed(state)
    : sleepEffect(retryDelayMs(retry, retryIndex)).pipe(
        Effect.zipRight(invoke(retryIndex + 1)),
        Effect.map((next) => ({
          outcome: next,
          retryCount: state.retryCount + 1,
          attempts: [...state.attempts, buildAttemptRecord(next, state.attempts.length + 1)],
        }))
      )

const projectRetryResult = (
  result: RetryReducerState,
  retry: ResolvedRetryConfig
): ActionOutcome => {
  if (result.outcome.status !== 'failure') {
    return {
      ...result.outcome,
      output: { ...(result.outcome.output ?? {}), attempts: result.attempts },
    }
  }
  const isExhausted = retry.maxAttempts > 1
  return {
    ...result.outcome,
    output: {
      ...(result.outcome.output ?? {}),
      retryCount: result.retryCount,
      attempts: result.attempts,
      ...(isExhausted ? { exhausted: true } : {}),
    },
  }
}

const dispatchWithRetry = (input: {
  readonly handler: ActionHandler
  readonly action: Readonly<Record<string, unknown>>
  readonly app: App
  readonly automation: StepContext['automation']
  readonly runContext: Parameters<ActionHandler>[3]
  readonly retry: ResolvedRetryConfig | undefined
}): Effect.Effect<ActionOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const { handler, action, app, automation, runContext, retry } = input
    const timeoutMs = resolveActionTimeoutMs(action)
    const invoke = (attempt: number): Effect.Effect<ActionOutcome, never, StepRequirements> => {
      const contextForAttempt = runContext === undefined ? runContext : { ...runContext, attempt }
      return withActionTimeout(
        handler(action, app, automation, contextForAttempt),
        timeoutMs,
        action
      )
    }
    const first = yield* invoke(1)
    if (first.status !== 'failure' || retry === undefined) return first
    const maxRetries = Math.max(0, retry.maxAttempts - 1)
    const initial: RetryReducerState = {
      outcome: first,
      retryCount: 0,
      attempts: [buildAttemptRecord(first, 1)],
    }
    const result = yield* Effect.reduce(
      Array.from({ length: maxRetries }, (_v, i) => i + 1),
      initial,
      (state, retryIndex) => stepRetry(state, retryIndex, retry, invoke)
    )
    return projectRetryResult(result, retry)
  })

const pickResponseOverride = (
  outcome: ActionOutcome,
  acc: RunAccumulator
): Readonly<Record<string, unknown>> | undefined =>
  outcome.responseOverride !== undefined ? outcome.responseOverride : acc.responseOverride

const pickReturnData = (
  outcome: ActionOutcome,
  acc: RunAccumulator
): {
  readonly returnData: Readonly<Record<string, unknown>> | undefined
  readonly halt: boolean
} => {
  const isReturn = outcome.returnData !== undefined && acc.returnData === undefined
  return { returnData: isReturn ? outcome.returnData : acc.returnData, halt: isReturn }
}

const shouldPropagateFailure = (
  rawAction: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome
): boolean => outcome.status === 'failure' && rawAction['continueOnError'] !== true

const foldStepOutput = (
  acc: RunAccumulator,
  stepName: string,
  out: Record<string, unknown> | undefined
): {
  readonly actions: RunAccumulator['actions']
  readonly lastOutput: RunAccumulator['lastOutput']
} =>
  out !== undefined
    ? {
        actions: { ...acc.actions, [stepName]: out },
        lastOutput: { ...(acc.lastOutput ?? {}), ...out },
      }
    : { actions: acc.actions, lastOutput: acc.lastOutput }

const buildStepsResultView = (
  actions: Readonly<Record<string, Record<string, unknown>>>
): Readonly<Record<string, Record<string, unknown>>> =>
  Object.fromEntries(
    Object.entries(actions).map(([name, output]) => [
      name,
      'result' in output ? output : { ...output, result: output },
    ])
  )

const resolveFailureRunStatus = (outcome: ActionOutcome): 'failure' | 'exhausted' => {
  const exhausted = outcome.output?.['exhausted']
  return exhausted === true ? 'exhausted' : 'failure'
}

const resolveRunStatusAfterStep = (
  rawAction: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome,
  acc: RunAccumulator
): RunAccumulator['runStatus'] => {
  const propagateFailure = shouldPropagateFailure(rawAction, outcome)
  if (propagateFailure) return resolveFailureRunStatus(outcome)
  if (outcome.status === 'failure' && acc.runStatus === 'success') {
    return 'completed-with-errors'
  }
  return acc.runStatus
}

const appendStepToAccumulator = (input: {
  readonly acc: RunAccumulator
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly resolvedProps: Record<string, unknown>
  readonly outcome: ActionOutcome
  readonly ctx: StepContext
}): RunAccumulator => {
  const { acc, rawAction, resolvedProps, outcome, ctx } = input
  const stepName = String(rawAction['name'] ?? '')
  const out =
    outcome.output !== undefined && stepName !== ''
      ? (outcome.output as Record<string, unknown>)
      : undefined
  const propagateFailure = shouldPropagateFailure(rawAction, outcome)
  const ret = pickReturnData(outcome, acc)
  const { actions, lastOutput } = foldStepOutput(acc, stepName, out)
  return {
    steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
    runStatus: resolveRunStatusAfterStep(rawAction, outcome, acc),
    runError: propagateFailure
      ? redactString(outcome.error ?? 'Action failed', ctx.app, ctx.processEnv)
      : acc.runError,
    actions,
    lastOutput,
    halted: acc.halted || ret.halt,
    responseOverride: pickResponseOverride(outcome, acc),
    returnData: ret.returnData,
  }
}

const foldOutcome = (input: {
  readonly acc: RunAccumulator
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly resolvedProps: Readonly<Record<string, unknown>>
  readonly outcome: ActionOutcome
  readonly ctx: StepContext
}): RunAccumulator => {
  const { acc, rawAction, resolvedProps, outcome, ctx } = input
  if (outcome.status === 'filtered') {
    return {
      ...acc,
      steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
      runStatus: 'skipped',
      halted: true,
    }
  }
  return appendStepToAccumulator({
    acc,
    rawAction,
    resolvedProps: resolvedProps as Record<string, unknown>,
    outcome,
    ctx,
  })
}

export const executeStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>,
  ctx: StepContext,
  buildAutomationInvoker: (ctx: StepContext) => AutomationInvoker
): Effect.Effect<RunAccumulator, never, StepRequirements> =>
  Effect.gen(function* () {
    const props = rawAction['props'] ?? {}
    const isCode = String(rawAction['type'] ?? '') === 'code'
    const stepsView = buildStepsResultView(acc.actions)
    const stepTemplateContext = isCode
      ? ctx.templateContext
      : { ...ctx.templateContext, ...stepsView, steps: stepsView }
    const subst = isCode ? props : resolveTriggerInValue(props, stepTemplateContext)
    const resolvedProps = resolveEnvInValue(subst, ctx.envLookup) as Record<string, unknown>
    const handler =
      ctx.handlers.get(
        actionKey(String(rawAction['type'] ?? ''), rawAction['operator'] as string | undefined)
      ) ?? noopActionHandler
    const runContext = {
      previousSteps: acc.actions,
      triggerData: ctx.triggerData,
      rawAction,
      envLookup: ctx.envLookup,
      invokeTemplate: buildTemplateInvoker(ctx, acc, new Set()),
      invokeNativeAction: buildNativeActionInvoker(ctx, acc, new Set()),
      invokeAutomation: buildAutomationInvoker(ctx),
    }
    const outcome: ActionOutcome = yield* dispatchWithRetry({
      handler,
      action: { ...rawAction, props: resolvedProps },
      app: ctx.app,
      automation: ctx.automation,
      runContext,
      retry: resolveRetryForAction(rawAction, ctx.automationRetry),
    })
    return foldOutcome({ acc, rawAction, resolvedProps, outcome, ctx })
  })

const buildSkippedStep = (rawAction: Readonly<Record<string, unknown>>): ExecutedStep => {
  const operator = rawAction['operator'] as string | undefined
  return {
    name: String(rawAction['name'] ?? ''),
    type: String(rawAction['type'] ?? ''),
    ...(operator !== undefined ? { operator } : {}),
    status: 'skipped',
  }
}

export const appendSkippedStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>
): RunAccumulator => ({
  ...acc,
  steps: [...acc.steps, buildSkippedStep(rawAction)],
})
