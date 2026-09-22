/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `automation:call` runtime invoker for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). Builds the
 * `context.actions.call(...)` callback threaded into every step's run
 * context — resolves the target automation, validates `inputData` against
 * the callee's `inputSchema`, enforces the recursion-depth + cycle guard,
 * and runs the callee via the injected `executeAutomationRun`.
 *
 * `executeAutomationRun` and `resolveAutomationId` live in the orchestrator
 * (`run-automation.ts`); they are injected as a `runners` parameter so this
 * module need not import the orchestrator (avoids an import cycle).
 */

import { Effect } from 'effect'
import { logError } from '@/infrastructure/logging/logger'
import { cryptoRandomId } from './types'
import type { AutomationInvoker, RunAutomationResult, RunRequirements, StepContext } from './types'
import type { App } from '@/domain/models/app'

/**
 * Orchestrator-owned run primitives injected into the `automation:call`
 * invoker so this module need not import `run-automation.ts`. Both effects
 * run inside the {@link RunRequirements} context their callers already
 * provide; `E` is left `unknown` because `resolveAutomationId` is wrapped
 * in `Effect.orElseSucceed` (its error tag is irrelevant here).
 */
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

/**
 * Minimal `inputSchema` gate for the `automation-call` trigger: rejects
 * when a `required` key is missing/empty in the caller's inputData.
 * Property-level type checking is deliberately out of scope — a callee
 * needing richer validation should put the rule in a `code` action (same
 * stance as the webhook trigger's request-schema validator). Returns an
 * error message string, or undefined on success.
 */
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

/**
 * Pre-run guard for `automation:call`: resolve the target automation and
 * reject (returns an `Error`) on a missing target, a recursion-cycle, an
 * exceeded `maxDepth`, or an `inputSchema` validation failure. Returns the
 * resolved automation + the new call depth on success.
 */
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

/** Build the `executeAutomationRun` Effect for a sub-automation invocation. */
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
    const automationId = yield* runners.resolveAutomationId(target.name, target).pipe(
      // effect-swallow: the id only LABELS this run in the activity log; a lookup that fails must not stop the automation it was about to run, and a random id keeps the run traceable within itself.
      Effect.orElseSucceed(() => cryptoRandomId())
    )
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

/**
 * Build the `automation:call` runtime callback threaded into every step's
 * run context. Resolves the target automation, validates the caller's
 * inputData against the target's `inputSchema`, enforces the recursion
 * depth + cycle guard, runs the target through `executeAutomationRun`
 * with `{ trigger: { input, caller, depth } }`, and resolves with the
 * callee's `automation:return` payload wrapped as `{ result }`.
 *
 * `mode: 'async'` fires the callee fire-and-forget and resolves with
 * `{ result: {} }`. Rejections surface as a failed `automation:call` step.
 */
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
        // Fire-and-forget. The caller already got `{ result: {} }`; surface a
        // log line if the background run rejects so operators can detect it.
        // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget background logging (promise result intentionally discarded)
        ctx.runProgram(subRun).then(
          () => undefined,
          (err) => {
            logError('[automation] async automation:call run rejected', err)
          }
        )
        return Promise.resolve({ result: {} })
      }
      return ctx.runProgram(subRun).then((result) => {
        if (result.status === 'failure') {
          // eslint-disable-next-line functional/no-throw-statements -- inside .then; throw-as-rejection is the unicorn-preferred form
          throw new Error(result.error ?? `called automation '${name}' failed`)
        }
        return { result: result.returnData ?? {} }
      })
    }
  }
