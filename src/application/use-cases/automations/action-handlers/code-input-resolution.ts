/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAuthoredValueReference } from '../authored-references'
import { hydratedFieldIdOf } from '../hydrated-field-reference'
import { lookupPath, resolveTriggerInString, resolveTriggerInValue } from '../resolve-trigger-data'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'

/** A string that is exactly one `{{ path.to.value }}` reference — no helper, no text. */
const SINGLE_REFERENCE = /^\s*\{\{\s*([\w.]+)\s*\}\}\s*$/

/**
 * A copy of a list or an object handed to user code, so the code cannot mutate
 * the prior step's output (or the trigger payload) that later steps and the
 * persisted run still read. `undefined` when the value cannot be copied — a
 * function-bearing object such as the `actions` proxy — and the caller then
 * renders as before.
 */
const detachedCopy = (found: object): unknown => {
  try {
    return structuredClone(found)
  } catch {
    return undefined
  }
}

/**
 * The value a lone `{{path}}` names, when it is one rendering would lose: a
 * list, an object, a number or a boolean arrives as itself (`{{step.records}}`
 * is the array, not its text) — a list or an object as a detached copy, and a
 * hydrated relationship or user field as the id it stores. A
 * string, an absent path or a helper name (`{{now}}`) answers `undefined`, and
 * the caller renders as before.
 */
const referencedValue = (value: string, context: Readonly<Record<string, unknown>>): unknown => {
  const reference = SINGLE_REFERENCE.exec(value)
  if (reference === null) return undefined
  const found = lookupPath(context, reference[1] as string)
  // A trigger's relationship or user field, referenced whole, is the id it
  // stores — the value its rendering and a trigger condition read.
  const hydratedId = hydratedFieldIdOf(found)
  if (hydratedId !== undefined) return hydratedId
  if (typeof found === 'object' && found !== null) return detachedCopy(found)
  return typeof found === 'number' || typeof found === 'boolean' ? found : undefined
}

/**
 * Pattern matching a string that is *exactly* a single `{{...}}` template
 * with no surrounding text. The code action's `inputData` resolver uses
 * this to detect "pure template" values and unwrap them to typed
 * primitives (number, boolean, parsed JSON) — Handlebars always returns
 * strings, but a user-authored `inputData: { x: '{{number steps.step1.value}}' }`
 * almost certainly wants `x: 8`, not `x: "8"`. Re-typing keeps the
 * sandbox's `+` operator (number addition) working without surprising
 * string-concat behaviour like `8 + 1 === "81"`.
 *
 * Helpers and dotted paths both match: `{{number x.y}}`, `{{trigger.data.n}}`.
 * Strings with surrounding text (e.g. `'order-{{trigger.data.id}}'`) DO
 * NOT match — those stay as strings, which is correct (they're
 * concatenated identifiers, not typed values).
 */
const PURE_TEMPLATE_PATTERN = /^\s*\{\{[\s\S]+?\}\}\s*$/

/**
 * Try to coerce a trimmed, rendered-template string into a typed primitive
 * (number, or parsed JSON object/array). Returns `undefined` when no
 * coercion applies — callers fall back to the original string.
 *
 * Number coercion is round-trip-exact: `'0078'` is NOT re-typed because
 * `String(Number('0078'))` is `'78'` (the leading zero is significant — a
 * zero-padded id / invoice number from `{{regex …}}`). JSON coercion fires
 * only for object/array shapes (`{…}` / `[…]`), which `{{json …}}`
 * produces; a malformed string parses-fails and falls through.
 */
const coerceTrimmedScalar = (trimmed: string): unknown => {
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    if (Number.isFinite(n) && String(n) === trimmed) return n
    return undefined
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Re-type a resolved-template string as a typed primitive when the
 * resolver was given a "pure" single-template input (e.g.
 * `'{{number steps.step1.value}}'`). Detection is conservative: only
 * triggers when the ORIGINAL value was a pure template AND the rendered
 * output round-trips cleanly to a number / boolean / parsed JSON.
 *
 * `'null'` is left as the literal string. The codebase preference is
 * `undefined` over `null`, and surfacing `null` as a typed value would
 * require user code to defensively check for it.
 */
const reTypeRenderedValue = (original: string, rendered: string): unknown => {
  // An authored `$env.X` / template `$name` is a value inserted as it is: an
  // env var reads as text, exactly as it did when it was filled in as text.
  if (!PURE_TEMPLATE_PATTERN.test(original) || isAuthoredValueReference(original)) return rendered
  const trimmed = rendered.trim()
  if (trimmed === '') return rendered
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const coerced = coerceTrimmedScalar(trimmed)
  return coerced !== undefined ? coerced : rendered
}

/**
 * Resolve a code action's `inputData` map against the code-specific
 * substitution context with typed unwrapping for pure-template
 * values. A value that is exactly one `{{path}}` reference to a list, an
 * object, a number or a boolean arrives as that value, unrendered. Behaves like `resolveTriggerInValue` for nested objects / arrays /
 * strings, but extra post-processing converts `'{{number ...}}'`-style
 * values back to numbers / booleans / objects so user code receives native
 * primitives instead of stringified ones.
 */
export const resolveCodeInputData = (
  rawInputData: Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>,
  templates: TemplateRenderer
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(rawInputData).map(([key, value]) => {
      if (typeof value === 'string') {
        const referenced = referencedValue(value, context)
        if (referenced !== undefined) return [key, referenced] as const
        const rendered = resolveTriggerInString(value, context, templates)
        return [key, reTypeRenderedValue(value, rendered)] as const
      }
      return [key, resolveTriggerInValue(value, context, templates)] as const
    })
  )
