/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { actionKey, noopActionHandler } from '../action-handlers'
import { applyTemplateVars } from '../expand-action-refs'
import { findTemplate, resolveActionPropsForDispatch } from './prop-substitution'
import type { RunAccumulator, StepContext } from './types'

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
  const handler = ctx.handlers.get(handlerKey) ?? noopActionHandler
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
      throw new Error(outcome.error ?? `${failureLabel} failed`)
    }
    return outcome.output
  })
}

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
    const synthetic: Record<string, unknown> = {
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
