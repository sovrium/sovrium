/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Code-sandbox action invokers for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). These build the
 * `context.actions.ref(...)` (template) and `context.actions.<type>.<op>(...)`
 * (native) proxy methods threaded into the code action's sandbox runtime
 * context. They are mutually recursive (a dispatched action's own sandbox
 * gets fresh invokers) and share one cycle-detection `invocationStack`.
 */

import { Effect } from 'effect'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { actionKey, missingActionHandler } from '../action-handlers'
import { applyTemplateVars } from '../expand-action-refs'
import { findTemplate, resolveActionPropsForDispatch } from './prop-substitution'
import type { RunAccumulator, StepContext } from './types'

/**
 * Shared "dispatch one action via the handler registry, return its
 * outcome.output as a Promise" helper. Used by BOTH the template
 * invoker (`context.actions.ref(...)`) AND the native-action invoker
 * (`context.actions.<type>.<op>(...)`). Threads the same
 * `invocationStack` through both invokers in the sub-runContext so
 * cross-cutting cycle detection works regardless of whether each level
 * is template- or native-flavoured.
 */
interface DispatchActionInput {
  readonly action: Readonly<Record<string, unknown>>
  readonly resolvedProps: Record<string, unknown>
  readonly ctx: StepContext
  readonly acc: RunAccumulator
  readonly invocationStack: ReadonlySet<string>
  readonly failureLabel: string
}

const dispatchActionAsPromise = (input: DispatchActionInput): Promise<unknown> => {
  const { action, resolvedProps, ctx, acc, invocationStack, failureLabel } = input
  const handlerKey = actionKey(
    String(action['type'] ?? ''),
    action['operator'] as string | undefined
  )
  // `buildNativeActionInvoker` already rejects an unregistered key before it
  // gets here; the template path (`buildTemplateInvoker`) does not, so this
  // fallback is what stops a template referencing a bad type/operator from
  // silently reporting success. Failure here surfaces as a rejected promise
  // (see below), which the calling handler records as its own failure.
  const handler = ctx.handlers.get(handlerKey) ?? missingActionHandler
  const subRunContext = {
    previousSteps: acc.actions,
    triggerData: ctx.triggerData,
    rawAction: action,
    envLookup: ctx.envLookup,
    invokeTemplate: buildTemplateInvoker(ctx, acc, invocationStack),
    invokeNativeAction: buildNativeActionInvoker(ctx, acc, invocationStack),
  }
  const program = handler(
    { ...action, props: resolvedProps },
    ctx.app,
    ctx.automation,
    subRunContext
  )
  return Effect.runPromise(provideAutomationRuntime(program)).then((outcome) => {
    if (outcome.status === 'failure') {
      // eslint-disable-next-line functional/no-throw-statements -- inside .then; throw-as-rejection is the unicorn-preferred form
      throw new Error(outcome.error ?? `${failureLabel} failed`)
    }
    return outcome.output
  })
}

/**
 * Build a template-invocation dispatcher for the code sandbox's
 * `context.actions.ref('<name>', vars)` proxy method. Looks up the
 * named template in `app.actions[]`, applies caller-supplied `vars`
 * over declared `variables` defaults, dispatches the resulting concrete
 * action through the shared {@link dispatchActionAsPromise} helper,
 * and resolves with the handler's `outcome.output`.
 *
 * The proxy semantics intentionally do NOT reach sibling steps: prior
 * step outputs flow into `code` actions only via the explicit
 * `inputData` template-resolution surface (`{{steps.X.Y}}` → resolved
 * before the sandbox sees it). This keeps the code action a pure
 * function of its declared inputs.
 *
 * Cycle detection: an `invocationStack` tracks templates currently
 * mid-invocation; calling a template already on the stack rejects with
 * a path-listing error so transitive recursion (template A's code
 * calls B which calls A) cannot run away.
 */
export const buildTemplateInvoker = (
  ctx: StepContext,
  acc: RunAccumulator,
  invocationStack: ReadonlySet<string>
): ((name: string, vars?: Readonly<Record<string, unknown>>) => Promise<unknown>) => {
  return (templateName, vars) => {
    if (invocationStack.has(templateName)) {
      const path = [...invocationStack, templateName].join(' → ')
      return Promise.reject(new Error(`action template cycle detected: ${path}`))
    }
    const template = findTemplate(ctx.app, templateName)
    if (template === undefined) {
      return Promise.reject(
        new Error(
          `action template '${templateName}' is not defined in app.actions[]. Declare it at the schema root before calling context.actions.ref('${templateName}', ...).`
        )
      )
    }
    const substituted = applyTemplateVars(template, vars) as Record<string, unknown>
    const resolvedProps = resolveActionPropsForDispatch(substituted, ctx)
    const newStack = new Set([...invocationStack, templateName])
    return dispatchActionAsPromise({
      action: substituted,
      resolvedProps,
      ctx,
      acc,
      invocationStack: newStack,
      failureLabel: `template '${templateName}'`,
    })
  }
}

/**
 * Build a native-action dispatcher for the code sandbox's
 * `context.actions.<actionType>.<operator>(props)` proxy. Synthesises
 * a concrete action object on the fly (no template required), resolves
 * env templates in props, and dispatches through the shared
 * {@link dispatchActionAsPromise} helper.
 *
 * Native dispatch never grows the cycle-detection stack on its own —
 * a native call is a single handler invocation that does not recurse
 * into the template registry. The stack is still THREADED through so
 * if a native action's handler is itself a `code` action whose body
 * invokes a template, the outer invocation stack remains visible to
 * the template invoker.
 */
export const buildNativeActionInvoker = (
  ctx: StepContext,
  acc: RunAccumulator,
  invocationStack: ReadonlySet<string>
): ((
  type: string,
  operator: string,
  props?: Readonly<Record<string, unknown>>
) => Promise<unknown>) => {
  return (type, operator, props) => {
    const handlerKey = actionKey(type, operator)
    if (!ctx.handlers.has(handlerKey)) {
      return Promise.reject(
        new Error(
          `native action '${type}.${operator}' is not registered. Declare a template at app.actions[] referencing the desired action, or check the type/operator spelling.`
        )
      )
    }
    const synthetic: Readonly<Record<string, unknown>> = {
      name: `inline:${type}.${operator}`,
      type,
      operator,
      props: props ?? {},
    }
    const resolvedProps = resolveActionPropsForDispatch(synthetic, ctx)
    return dispatchActionAsPromise({
      action: synthetic,
      resolvedProps,
      ctx,
      acc,
      invocationStack,
      failureLabel: `native action '${type}.${operator}'`,
    })
  }
}
