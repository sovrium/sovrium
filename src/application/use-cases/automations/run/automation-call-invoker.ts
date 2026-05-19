/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { cryptoRandomId } from './types'
import type { AutomationInvoker, RunAutomationResult, RunRequirements, StepContext } from './types'
import type { App } from '@/domain/models/app'

export interface AutomationCallRunners {
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
    readonly triggerData: {
      readonly input: Readonly<Record<string, unknown>>
      readonly caller: string
      readonly depth: number
    }
    readonly handlers: StepContext['handlers']
    readonly userId: string | undefined
    readonly callDepth: number
    readonly visitedAutomations: ReadonlySet<string>
  }) => Effect.Effect<RunAutomationResult, never, RunRequirements>
}

const validateAgainstInputSchema = (
  inputData: Readonly<Record<string, unknown>>,
  inputSchema: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  if (inputSchema === undefined) return undefined
  const { required } = inputSchema
  if (!Array.isArray(required)) return undefined
  const missing = (required as ReadonlyArray<unknown>)
    .filter((k): k is string => typeof k === 'string')
    .filter((k) => inputData[k] === undefined || inputData[k] === null || inputData[k] === '')
  return missing.length === 0
    ? undefined
    : `inputData failed validation against the callee's inputSchema: missing required field(s) ${missing.join(', ')}`
}

const resolveCallTarget = (
  ctx: StepContext,
  name: string,
  inputData: Readonly<Record<string, unknown>>,
  maxDepth: number
):
  | {
      readonly ok: true
      readonly target: NonNullable<App['automations']>[number]
      readonly newDepth: number
    }
  | { readonly ok: false; readonly error: Error } => {
  const target = ctx.app.automations?.find((a) => a.name === name)
  if (target === undefined) {
    return {
      ok: false,
      error: new Error(`automation:call references automation '${name}' which does not exist`),
    }
  }
  if (ctx.visitedAutomations.has(name)) {
    const path = [...ctx.visitedAutomations, name].join(' → ')
    return { ok: false, error: new Error(`automation:call circular-reference detected: ${path}`) }
  }
  const newDepth = ctx.callDepth + 1
  if (newDepth > maxDepth) {
    return {
      ok: false,
      error: new Error(
        `automation:call exceeded the maximum call depth (${String(maxDepth)}) — possible infinite recursion`
      ),
    }
  }
  const triggerInputSchema =
    target.trigger.type === 'automation-call'
      ? (target.trigger.inputSchema as Readonly<Record<string, unknown>> | undefined)
      : undefined
  const schemaError = validateAgainstInputSchema(inputData, triggerInputSchema)
  if (schemaError !== undefined) return { ok: false, error: new Error(schemaError) }
  return { ok: true, target, newDepth }
}

const buildSubAutomationRun = (
  input: {
    readonly ctx: StepContext
    readonly target: NonNullable<App['automations']>[number]
    readonly inputData: Readonly<Record<string, unknown>>
    readonly newDepth: number
  },
  runners: AutomationCallRunners
): Effect.Effect<RunAutomationResult, never, RunRequirements> =>
  Effect.gen(function* () {
    const { ctx, target, inputData, newDepth } = input
    const automationId = yield* runners
      .resolveAutomationId(target.name, target)
      .pipe(Effect.orElseSucceed(() => cryptoRandomId()))
    return yield* runners.executeAutomationRun({
      name: target.name,
      automation: target,
      automationId,
      app: ctx.app,
      processEnv: ctx.processEnv,
      triggerData: { input: inputData, caller: ctx.automation.name, depth: newDepth },
      handlers: ctx.handlers,
      userId: ctx.automation.userId,
      callDepth: newDepth,
      visitedAutomations: ctx.visitedAutomations,
    })
  })

export const buildAutomationInvoker =
  (runners: AutomationCallRunners) =>
  (ctx: StepContext): AutomationInvoker => {
    return ({ name, inputData, mode, maxDepth }) => {
      const resolved = resolveCallTarget(ctx, name, inputData, maxDepth)
      if (!resolved.ok) return Promise.reject(resolved.error)
      const subRun = buildSubAutomationRun(
        { ctx, target: resolved.target, inputData, newDepth: resolved.newDepth },
        runners
      )
      if (mode === 'async') {
        Effect.runPromise(provideAutomationRuntime(subRun)).then(
          () => undefined,
          (err) => {
            console.error('[automation] async automation:call run rejected', err)
          }
        )
        return Promise.resolve({ result: {} })
      }
      return Effect.runPromise(provideAutomationRuntime(subRun)).then((result) => {
        if (result.status === 'failure') {
          throw new Error(result.error ?? `called automation '${name}' failed`)
        }
        return { result: result.returnData ?? {} }
      })
    }
  }
