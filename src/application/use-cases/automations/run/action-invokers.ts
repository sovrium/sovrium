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
import { announceRecordWrites } from '@/application/use-cases/tables/record-change-announcement'
import { actionKey, missingActionHandler } from '../action-handlers'
import {
  authoredReferenceRoots,
  fillAuthoredReferences,
  referenceAuthoredValues,
} from '../authored-references'
import { readActionIdentity } from './action-identity'
import { findTemplate, renderAuthoredTemplateProps } from './prop-substitution'
import { buildStep } from './step-record'
import type { ReadTracker } from './read-tracker'
import type { RunAccumulator, StepContext } from './types'
import type { ActionHandler, ActionRunContext, NestedStepInvoker } from '../action-handlers/shared'

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
  readonly resolvedProps: Readonly<Record<string, unknown>>
  /** The props as authored, for a handler that renders its own; for final
   *  props, the props themselves. */
  readonly authoredProps: Readonly<Record<string, unknown>>
  /** A named template's variables, read by its `{{$vars.name}}` references. */
  readonly templateVars?: Readonly<Record<string, unknown>>
  /** The props are values a step handed over: never rendered again. */
  readonly propsFinal: boolean
  readonly ctx: StepContext
  readonly acc: RunAccumulator
  readonly invocationStack: ReadonlySet<string>
  readonly failureLabel: string
  /** Where the step records what this dispatch read. */
  readonly tracker: ReadTracker
}

/**
 * What every action dispatched on a step's behalf (by a script, a path or a
 * loop) runs with besides its own props: the env, the invokers — sharing the
 * step's cycle-detection stack and read tracker — and the record-event
 * channel, so a record it writes starts the record automations of its table
 * under the run's depth limit, exactly as a top-level step's write does.
 */
const dispatchedContext = (
  ctx: StepContext,
  acc: RunAccumulator,
  invocationStack: ReadonlySet<string>,
  tracker: ReadTracker
): Pick<
  ActionRunContext,
  | 'envLookup'
  | 'templates'
  | 'invokeTemplate'
  | 'invokeNativeAction'
  | 'runNestedStep'
  | 'recordEvents'
> => ({
  envLookup: ctx.envLookup,
  templates: ctx.templates,
  invokeTemplate: buildTemplateInvoker(ctx, acc, invocationStack, tracker),
  invokeNativeAction: buildNativeActionInvoker(ctx, acc, invocationStack, tracker),
  runNestedStep: buildNestedStepInvoker(ctx, acc, invocationStack, tracker),
  recordEvents: ctx.recordEvents,
})

const dispatchActionAsPromise = (input: DispatchActionInput): Promise<unknown> => {
  const { action, resolvedProps, ctx, acc, invocationStack, failureLabel, tracker } = input
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
    authoredProps: input.authoredProps,
    ...(input.templateVars === undefined ? {} : { templateVars: input.templateVars }),
    ...(input.propsFinal ? { propsFinal: true as const } : {}),
    ...dispatchedContext(ctx, acc, invocationStack, tracker),
  }
  // Its own announcing scope: this program runs detached from the calling
  // step's fiber, so the rows it writes are announced as one write of its own.
  const program = announceRecordWrites(ctx.app)(
    handler({ ...action, props: resolvedProps }, ctx.app, ctx.automation, subRunContext)
  )
  return ctx.runProgram(program).then((outcome) => {
    // What it read is recorded whatever the outcome: a failed read may still
    // carry what it read in its error.
    tracker.dispatched(ctx.app, { ...action, props: resolvedProps }, outcome.output)
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
  invocationStack: ReadonlySet<string>,
  tracker: ReadTracker
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
    // The template is authored config: its body is rendered ONCE, with the
    // caller's `vars` and the env values inserted as values the template pass
    // never parses (`{{$vars.name}}`, `{{$env.NAME}}`). A variable default is
    // config too, so its own `$env.X` is filled in first; the merged
    // variables are values from then on.
    const defaults = fillAuthoredReferences(template.variables ?? {}, {
      envLookup: ctx.envLookup,
    })
    const values = { envLookup: ctx.envLookup, vars: { ...defaults, ...(vars ?? {}) } }
    const referenced = referenceAuthoredValues(template.action, values)
    // A code action's source is never a template: its references are filled in
    // as text, and so is the action other handlers read as written.
    const filled = fillAuthoredReferences(template.action, values)
    const isCode = String(template.action['type'] ?? '') === 'code'
    const { props: resolvedProps, refusal } = renderAuthoredTemplateProps(
      isCode ? filled : referenced,
      { ...ctx.templateContext, ...authoredReferenceRoots(values) },
      ctx.templates
    )
    if (refusal !== undefined) return Promise.reject(new Error(refusal))
    const newStack = new Set([...invocationStack, templateName])
    return dispatchActionAsPromise({
      action: filled,
      resolvedProps,
      authoredProps: (referenced['props'] ?? {}) as Readonly<Record<string, unknown>>,
      templateVars: values.vars,
      propsFinal: false,
      ctx,
      acc,
      invocationStack: newStack,
      failureLabel: `template '${templateName}'`,
      tracker,
    })
  }
}

/**
 * Build a native-action dispatcher for the code sandbox's
 * `context.actions.<actionType>.<operator>(props)` proxy. Synthesises
 * a concrete action object on the fly (no template required) and
 * dispatches it with its props as given — never rendered — through the shared
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
  invocationStack: ReadonlySet<string>,
  tracker: ReadTracker
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
    // The props are values the calling step built (a code action's call, an
    // item a loop filled in, a branch's resolved action): final, so neither
    // this dispatch nor the handler renders them again.
    const finalProps = props ?? {}
    return dispatchActionAsPromise({
      action: synthetic,
      resolvedProps: finalProps,
      authoredProps: finalProps,
      propsFinal: true,
      ctx,
      acc,
      invocationStack,
      failureLabel: `native action '${type}.${operator}'`,
      tracker,
    })
  }
}

/**
 * Build the dispatcher a `path` or a `loop` runs each nested action through
 * (`ActionRunContext.runNestedStep`). Unlike {@link buildNativeActionInvoker},
 * which hands a script only the `output`, it resolves with the WHOLE outcome
 * and the nested step's record:
 * the branch or loop decides what a failure, a `flow/stop` (`returnData`), a
 * stopping filter or a pause does to the rest of its actions and to the run.
 *
 * The nested action keeps its own name and runs with the outputs the caller
 * passes as `previousSteps` — the run's, plus what earlier nested actions of
 * the same path or item produced — so `{{<step>.*}}` reads them.
 */
export const buildNestedStepInvoker = (
  ctx: StepContext,
  acc: RunAccumulator,
  invocationStack: ReadonlySet<string>,
  tracker: ReadTracker
): NestedStepInvoker => {
  return ({ action, props, previousSteps, refusal }) => {
    const { type, operator } = readActionIdentity(action)
    const found = ctx.handlers.get(actionKey(type, operator)) ?? missingActionHandler
    // A prop a value from run data could not be placed in safely: the action
    // fails without running, recorded like any other failed nested step.
    const handler: ActionHandler =
      refusal === undefined ? found : () => Effect.succeed({ status: 'failure', error: refusal })
    const rawAction = { ...action, props }
    const subRunContext: ActionRunContext = {
      previousSteps,
      triggerData: ctx.triggerData,
      rawAction,
      authoredProps: props,
      propsFinal: true,
      ...dispatchedContext(ctx, acc, invocationStack, tracker),
    }
    const program = announceRecordWrites(ctx.app)(
      handler(rawAction, ctx.app, ctx.automation, subRunContext)
    )
    return ctx.runProgram(program).then((outcome) => {
      tracker.dispatched(ctx.app, rawAction, outcome.output)
      // Recorded, and masked, exactly as a top-level step is.
      return { outcome, step: buildStep(rawAction, props, outcome, ctx) }
    })
  }
}
