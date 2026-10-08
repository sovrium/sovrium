/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single-step dispatch for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). Owns: per-step
 * prop resolution, the action-template / native-action sandbox invokers,
 * the per-action retry + timeout machinery, and the pure folds that merge
 * an action's outcome into the run accumulator.
 *
 * The `automation:call` invoker is supplied by the orchestrator as a
 * parameter (`buildAutomationInvoker`) so this module need not import
 * `run-automation.ts` — that would form an import cycle.
 */

import { Effect } from 'effect'
import { actionKey, missingActionHandler, type ActionOutcome } from '../action-handlers'
import { buildStepsResultView, resolveOwnProp } from '../action-handlers/run-context-resolution'
import { authoredReferenceRoots, fillAuthoredReferences } from '../authored-references'
import { readActionIdentity } from './action-identity'
import {
  buildNativeActionInvoker,
  buildNestedStepInvoker,
  buildTemplateInvoker,
} from './action-invokers'
import { referenceAuthoredProps } from './prop-substitution'
import { createReadTracker, trackedInvoker, withRecordedReads } from './read-tracker'
import { renderActionProps } from './render-action-props'
import { foldOutcome } from './step-outcome'
import { dispatchWithRetry } from './step-retry'
import {
  resolveRetryForAction,
  type AutomationInvoker,
  type ExecutedStep,
  type RunAccumulator,
  type StepContext,
  type StepRequirements,
} from './types'
import type { ActionRunContext } from '../action-handlers/shared'

type StepProps = Record<string, unknown>

/**
 * Fill in one action's props for dispatch, ONCE.
 *
 * Non-code actions get prior step outputs exposed three ways in their
 * props: under `{{steps.X.Y}}` (e.g. `automation:return`'s `data`
 * referencing `{{steps.charge.transactionId}}`), at the top level as
 * `{{X.Y}}`, and under a `.result` alias as `{{X.result.Y}}` /
 * `{{steps.X.result.Y}}`. The `.result` alias is the canonical chaining
 * path the file-action specs use (`{{generateReport.result.key}}`) and
 * mirrors the `automation:call` output which natively nests under
 * `result`. The code sandbox already exposes `context.steps.X` via its
 * own internal context, so it skips this (and re-resolves `inputData` itself).
 *
 * The AUTHORED props are filled in once. `$env.X` becomes a value the
 * template pass inserts without parsing it, so neither an env value nor
 * text a template pulls in from a caller is ever read as a template or for
 * `$env.` (see referenceAuthoredProps). A code action's source is never a
 * template: its env references are filled in as text. Final props (an
 * invoked template, filled in once before the run) are taken as given, here
 * and by the handler.
 */
const fillStepProps = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>,
  ctx: StepContext
): {
  readonly authored: unknown
  readonly resolvedProps: StepProps
  readonly final: boolean
  readonly refusal?: string
} => {
  const props = rawAction['props'] ?? {}
  if (ctx.propsFinal === true)
    return { authored: props, resolvedProps: props as StepProps, final: true }
  const authored = referenceAuthoredProps(props, ctx)
  if (String(rawAction['type'] ?? '') === 'code') {
    const filled = fillAuthoredReferences(props, { envLookup: ctx.envLookup })
    return { authored, resolvedProps: filled as StepProps, final: false }
  }
  const stepsView = buildStepsResultView(acc.actions)
  const stepTemplateContext = {
    ...ctx.templateContext,
    ...stepsView,
    steps: stepsView,
    // The env values an authored `$env.X` inserts, read under `$env`.
    ...authoredReferenceRoots({ envLookup: ctx.envLookup }),
  }
  const { type, operator } = readActionIdentity(rawAction)
  const rendered = renderActionProps({
    type,
    operator: operator ?? '',
    authored,
    context: stepTemplateContext,
    templates: ctx.templates,
  })
  return {
    authored,
    resolvedProps: rendered.props,
    final: false,
    ...(rendered.refusal === undefined ? {} : { refusal: rendered.refusal }),
  }
}

/**
 * A step run from a named action template carries the template's variables as
 * `$vars`: as the calling automation wrote them (a `$ref`, filled in here,
 * against the run, once), or as an MCP client's arguments already filled them
 * (final props, taken as given). An inline template inside the step kept its
 * `$name` references (`{{$vars.name}}`) and reads them from here.
 */
const withExpandedTemplateVars = <C extends ActionRunContext>(
  rawAction: Readonly<Record<string, unknown>>,
  runContext: C
): C => {
  const vars = rawAction['$vars']
  if (vars === null || typeof vars !== 'object' || Array.isArray(vars)) return runContext
  const filled = resolveOwnProp(runContext, vars) as Readonly<Record<string, unknown>>
  return { ...runContext, templateVars: filled }
}

/**
 * Execute one action: resolve `$env.VAR` references in its authored props
 * (then its `{{...}}` templates), dispatch
 * to the registered handler, retry per policy, and fold the outcome into
 * the accumulator.
 *
 * `buildAutomationInvoker` is supplied by the orchestrator so the
 * `automation:call` runtime callback can be threaded into the per-step run
 * context without this module importing `run-automation.ts`.
 */
export const executeStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>,
  ctx: StepContext,
  buildAutomationInvoker: (ctx: StepContext, stepIndex: number) => AutomationInvoker
): Effect.Effect<RunAccumulator, never, StepRequirements> =>
  Effect.gen(function* () {
    const { authored, resolvedProps, final, refusal } = fillStepProps(acc, rawAction, ctx)
    const tracker = createReadTracker()
    // One call invoker per step, shared by everything the step dispatches: a
    // call a loop, a path or a script makes is held to the same guards.
    const scope = {
      tracker,
      invokeAutomation: trackedInvoker(buildAutomationInvoker(ctx, acc.steps.length), tracker),
    }
    // An unregistered key FAILS the step rather than silently succeeding. Every
    // action AppSchema can declare has a handler — asserted by
    // `registry-schema-coverage.test.ts` — so no config an author can write
    // reaches the fallback. `ref` never arrives here either: `expandRefActions`
    // rewrites it to its target before the run loop starts.
    const { type, operator } = readActionIdentity(rawAction)
    const handler = ctx.handlers.get(actionKey(type, operator)) ?? missingActionHandler
    const builtContext = {
      previousSteps: acc.actions,
      triggerData: ctx.triggerData,
      rawAction,
      authoredProps: authored as Readonly<Record<string, unknown>>,
      ...(final ? { propsFinal: true as const } : {}),
      envLookup: ctx.envLookup,
      templates: ctx.templates,
      // The 0-indexed position of this action: the count of steps already
      // recorded (after a resumed segment's first index) equals the index of
      // the action about to run. The approval handler records it.
      stepIndex: (ctx.resume?.base ?? 0) + acc.steps.length,
      // A resumed segment's first action is the loop or path it re-enters.
      ...(acc.steps.length === 0 && ctx.resume?.container !== undefined
        ? { resume: ctx.resume.container }
        : {}),
      invokeTemplate: buildTemplateInvoker(ctx, acc, new Set(), scope),
      invokeNativeAction: buildNativeActionInvoker(ctx, acc, new Set(), scope),
      runNestedStep: buildNestedStepInvoker(ctx, acc, new Set(), scope),
      invokeAutomation: scope.invokeAutomation,
      recordEvents: ctx.recordEvents,
    }
    const runContext = withExpandedTemplateVars(rawAction, builtContext)
    // A prop a value from run data could not be placed in safely: the step
    // fails before the action runs, so nothing is sent.
    if (refusal !== undefined) {
      const refused: ActionOutcome = { status: 'failure', error: refusal }
      return foldOutcome({ acc, rawAction, resolvedProps, outcome: refused, ctx })
    }
    const outcome: ActionOutcome = yield* dispatchWithRetry({
      handler,
      action: { ...rawAction, props: resolvedProps },
      app: ctx.app,
      automation: ctx.automation,
      runContext,
      retry: resolveRetryForAction(rawAction, ctx.automationRetry),
    })
    const tracked = withRecordedReads(outcome, rawAction, tracker)
    return foldOutcome({ acc, rawAction, resolvedProps, outcome: tracked, ctx })
  }).pipe(Effect.withSpan('automations.execute-step'))

/**
 * Build a `'skipped'` step record for an action that was never executed
 * because a previous step propagated a failure. Records the action's
 * identifying metadata (name/type/operator) but omits `props`/`output`/`error`
 * — the action never ran, so there is nothing to surface. Used by the
 * post-failure short-circuit in the run loop so callers can see every
 * action's terminal state, not just those that executed.
 *
 * "when action N fails actions before N show
 * completed and actions after N show skipped".
 */
const buildSkippedStep = (rawAction: Readonly<Record<string, unknown>>): ExecutedStep => ({
  ...readActionIdentity(rawAction),
  status: 'skipped',
})

/**
 * Append a `'skipped'` step record without executing the action. The run
 * accumulator's runStatus / actions map / lastOutput remain unchanged —
 * skipped steps contribute nothing to the run's data flow, they're recorded
 * purely for observability.
 */
export const appendSkippedStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>
): RunAccumulator => ({
  ...acc,
  steps: [...acc.steps, buildSkippedStep(rawAction)],
})
