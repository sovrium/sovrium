/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { authoredReferenceRoots } from '../authored-references'
import { hydratedFieldIdOf } from '../hydrated-field-reference'
import {
  buildAutomationContext,
  isTemplateHelperName,
  lookupPath,
  resolveTriggerInString,
} from '../resolve-trigger-data'
import { renderActionProps, type RenderedActionProps } from '../run/render-action-props'
import type { ActionRunContext } from './shared'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'

/**
 * Raw-props resolution shared by handlers that must template-resolve their
 * own props instead of relying on the run loop's `resolveTriggerInValue`.
 *
 * Two handler families need this and share the exact same machinery:
 *
 *  - `data/*` (`data.ts`) — its transforms (`aggregate`, `sort`, `merge`, …)
 *    operate on arrays/objects, but `resolveTriggerInValue` stringifies
 *    non-scalar leaves (`String([{…}])` → `"[object Object]"`), so the
 *    handler reads the RAW pre-substitution action and resolves
 *    `{{...}}` itself — returning the actual value for whole-string
 *    references, string substitution otherwise.
 *  - `loop/each` (`loop.ts`) — same problem (`items` would be flattened),
 *    plus the nested `actions` carry `{{loop.*}}` placeholders that only
 *    exist once iteration is under way, so they too must be re-resolved
 *    per item.
 *
 * The #63 (data) audit flagged extracting this once a third handler family
 * needed the pattern; `loop` is the second consumer of *this exact*
 * extraction (`code.ts`/`code-input-resolution.ts` does a different thing —
 * primitive RE-TYPING of pure-template values for the sandbox `+`
 * operator — so it stays separate). Two verbatim copies is already worth
 * one source of truth.
 */

/** Matches a string that is *exactly* one `{{ path.to.value }}` template
 *  (no surrounding text) — those unwrap to the raw value at that path,
 *  preserving arrays/objects. */
const SIMPLE_PATH = /^\{\{\s*([\w.]+)\s*\}\}$/

/**
 * Resolve a prop value against the run context, recursively:
 *  - whole-string `{{path}}` → raw value at that path (arrays/objects survive),
 *    except a hydrated relationship or user field, which is its id
 *  - interpolated string (`"order-{{trigger.data.id}}"`) → string substitution
 *  - array / object → recurse into each element / value
 *  - scalar non-string (numbers like `count: 2`) → returned verbatim
 */
export const resolveRunContextValue = (
  value: unknown,
  context: Readonly<Record<string, unknown>>,
  templates: TemplateRenderer
): unknown => {
  if (typeof value === 'string') {
    const whole = SIMPLE_PATH.exec(value.trim())
    if (whole === null) return resolveTriggerInString(value, context, templates)
    const name = whole[1] as string
    const found = lookupPath(context, name)
    // A trigger's relationship or user field, referenced whole, is its id, as
    // it is at the top level of a run (see `../hydrated-field-reference`).
    const hydratedId = hydratedFieldIdOf(found)
    if (hydratedId !== undefined) return hydratedId
    // A helper (`{{now}}`) is rendered, as it is at the top level of a run. Only
    // a helper: an unknown path stays `undefined` rather than rendering to ''.
    return found === undefined && isTemplateHelperName(name, templates)
      ? resolveTriggerInString(value, context, templates)
      : found
  }
  if (Array.isArray(value)) return value.map((v) => resolveRunContextValue(v, context, templates))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        resolveRunContextValue(v, context, templates),
      ])
    )
  }
  return value
}

/** The action's props as authored, ready for the template pass (see
 *  `ActionRunContext.authoredProps`) — or, for final props, the props as
 *  given. Falls back to the raw props when neither was threaded. */
export const authoredActionProps = (
  runContext: ActionRunContext
): Readonly<Record<string, unknown>> => runContext.authoredProps ?? rawActionProps(runContext)

/**
 * Fill in a value of the action's own props against the run context, once —
 * or return it as given when the props are final (`propsFinal`): a value a
 * step handed over is never rendered as a template again.
 *
 * The single entry point for a handler that renders its own props, so the
 * "final" rule lives here rather than in each of them.
 */
export const resolveOwnProp = (runContext: ActionRunContext, value: unknown): unknown =>
  runContext.propsFinal === true
    ? value
    : resolveRunContextValue(value, buildRunContextView(runContext), runContext.templates)

/** {@link resolveOwnProp} over the whole of the action's own props. */
export const resolveOwnProps = (runContext: ActionRunContext): Readonly<Record<string, unknown>> =>
  resolveOwnProp(runContext, authoredActionProps(runContext)) as Readonly<Record<string, unknown>>

/** The `props` map of the raw, pre-substitution action carried on the run
 *  context. `{}` when absent. */
export const rawActionProps = (runContext: ActionRunContext): Readonly<Record<string, unknown>> => {
  const ra = (runContext.rawAction ?? {}) as Readonly<Record<string, unknown>>
  return (ra['props'] ?? {}) as Readonly<Record<string, unknown>>
}

/**
 * Expose each prior step's output under a `.result` alias as well as its
 * bare keys, so a downstream action can reference either `{{step.key}}` or
 * `{{step.result.key}}`. The `.result` alias is the canonical step-chaining
 * path the file-action specs depend on (`{{generateReport.result.key}}`) and
 * mirrors the `automation:call` output, whose payload natively nests under
 * `result`. An output that ALREADY carries a `result` key (automation:call)
 * is passed through untouched so its own `result` is not double-wrapped.
 *
 * The run loop builds its top-level template context with it, and
 * {@link buildRunContextView} builds a handler's, so a template reads the same
 * inside a `path` branch or a loop body as it does at the top level.
 */
export const buildStepsResultView = (
  actions: Readonly<Record<string, Readonly<Record<string, unknown>>>>
): Readonly<Record<string, Readonly<Record<string, unknown>>>> =>
  Object.fromEntries(
    Object.entries(actions).map(([name, output]) => [
      name,
      'result' in output ? output : { ...output, result: output },
    ])
  )

/**
 * The substitution context a handler sees during a run: the trigger view
 * (`{{trigger.data.X}}`), prior step outputs both as top-level keys
 * (`{{stepName.X}}`, `{{stepName.result.X}}`) and under `steps`
 * (`{{steps.stepName.X}}`), and the env and template-variable values the
 * authored text references.
 *
 * Callers that add their own keys (e.g. `loop` adds `loop: { item, index }`)
 * spread this and override.
 */
export const buildRunContextView = (
  runContext: ActionRunContext
): Readonly<Record<string, unknown>> => {
  const stepsView = buildStepsResultView(runContext.previousSteps)
  return {
    ...stepsView,
    ...buildAutomationContext(runContext.triggerData as never),
    steps: stepsView,
    // Written last so no step name shadows them: the values an authored
    // `$env.X` / `$name` reference inserts (see `../authored-references`).
    ...authoredReferenceRoots({
      envLookup: runContext.envLookup,
      vars: runContext.templateVars,
    }),
  }
}

/**
 * Fill in the props of an action nested in a `path` or a `loop` against
 * `context`, for the place each one lands (see `../run/render-action-props`):
 * a prop with no position of its own keeps its type, as
 * {@link resolveRunContextValue} gives it.
 */
export const renderNestedActionProps = (
  action: Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>,
  templates: TemplateRenderer
): RenderedActionProps => ({
  ...renderActionProps({
    type: String(action['type'] ?? ''),
    operator: String(action['operator'] ?? ''),
    authored: action['props'] ?? {},
    context,
    templates,
    renderValue: (value) => resolveRunContextValue(value, context, templates),
  }),
  ...nestedTemplateVars(action, (vars) => resolveRunContextValue(vars, context, templates)),
})

/** The props of a nested action a step handed over, final: run as given, `$vars` included. */
export const finalNestedActionProps = (
  action: Readonly<Record<string, unknown>>
): RenderedActionProps => ({
  props: (action['props'] ?? {}) as Record<string, unknown>,
  ...nestedTemplateVars(action, (vars) => vars),
})

/**
 * The variables a named template called from a path or a loop carries
 * (`$vars`, see `../expand-action-refs`), filled in against the same context
 * as its props: an inline template inside it reads them as `{{$vars.name}}`,
 * exactly as it does when the template is a top-level step.
 */
const nestedTemplateVars = (
  action: Readonly<Record<string, unknown>>,
  fill: (vars: Readonly<Record<string, unknown>>) => unknown
): Pick<RenderedActionProps, 'templateVars'> => {
  const vars = action['$vars']
  if (vars === null || typeof vars !== 'object' || Array.isArray(vars)) return {}
  return {
    templateVars: fill(vars as Readonly<Record<string, unknown>>) as Readonly<
      Record<string, unknown>
    >,
  }
}

/** Narrow an `unknown` to an array, else `[]`. */
export const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])
