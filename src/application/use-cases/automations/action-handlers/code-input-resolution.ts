/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInString, resolveTriggerInValue } from '../resolve-trigger-data'

/**
 * Pattern matching a string that is *exactly* a single `{{...}}` template
 * with no surrounding text. The code action's `inputData` / `input` resolver
 * uses this to detect "pure template" values and unwrap them to typed
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
  if (!PURE_TEMPLATE_PATTERN.test(original)) return rendered
  const trimmed = rendered.trim()
  if (trimmed === '') return rendered
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const coerced = coerceTrimmedScalar(trimmed)
  return coerced !== undefined ? coerced : rendered
}

/**
 * Resolve a code action's `inputData` / `input` map against the
 * code-specific substitution context with typed unwrapping for pure-template
 * values. Behaves like `resolveTriggerInValue` for nested objects / arrays /
 * strings, but extra post-processing converts `'{{number ...}}'`-style
 * values back to numbers / booleans / objects so user code receives native
 * primitives instead of stringified ones.
 */
export const resolveCodeInputData = (
  rawInputData: Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(rawInputData).map(([key, value]) => {
      if (typeof value === 'string') {
        const rendered = resolveTriggerInString(value, context)
        return [key, reTypeRenderedValue(value, rendered)] as const
      }
      return [key, resolveTriggerInValue(value, context)] as const
    })
  )
