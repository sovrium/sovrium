/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildAutomationContext, resolveTriggerInString } from '../resolve-trigger-data'
import type { ActionRunContext } from './shared'

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

/** Walk a dotted path through a context object; `undefined` on any miss. */
export const lookupPath = (context: Readonly<Record<string, unknown>>, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[segment]
  }, context)

/**
 * Resolve a prop value against the run context, recursively:
 *  - whole-string `{{path}}` → raw value at that path (arrays/objects survive)
 *  - interpolated string (`"order-{{trigger.data.id}}"`) → string substitution
 *  - array / object → recurse into each element / value
 *  - scalar non-string (numbers like `count: 2`) → returned verbatim
 */
export const resolveRunContextValue = (
  value: unknown,
  context: Readonly<Record<string, unknown>>
): unknown => {
  if (typeof value === 'string') {
    const whole = SIMPLE_PATH.exec(value.trim())
    return whole !== null
      ? lookupPath(context, whole[1] as string)
      : resolveTriggerInString(value, context)
  }
  if (Array.isArray(value)) return value.map((v) => resolveRunContextValue(v, context))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        resolveRunContextValue(v, context),
      ])
    )
  }
  return value
}

/** The `props` map of the raw, pre-substitution action carried on the run
 *  context. `{}` when absent. */
export const rawActionProps = (runContext: ActionRunContext): Readonly<Record<string, unknown>> => {
  const ra = (runContext.rawAction ?? {}) as Readonly<Record<string, unknown>>
  return (ra['props'] ?? {}) as Readonly<Record<string, unknown>>
}

/**
 * The substitution context a handler sees during a run: the trigger view
 * (`{{trigger.data.X}}`), prior step outputs both as top-level keys
 * (`{{stepName.X}}`) and under `steps` (`{{steps.stepName.X}}`).
 *
 * Callers that add their own keys (e.g. `loop` adds `loop: { item, index }`)
 * spread this and override.
 */
export const buildRunContextView = (
  runContext: ActionRunContext
): Readonly<Record<string, unknown>> => ({
  ...runContext.previousSteps,
  ...buildAutomationContext(runContext.triggerData as never),
  steps: runContext.previousSteps,
})

/** Narrow an `unknown` to an array, else `[]`. */
export const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])
