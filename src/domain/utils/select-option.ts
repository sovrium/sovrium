/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Normalisation for a select-field option (`single-select` / `multi-select` /
 * `status`), which is either a bare string or a `{ value, label?, color? }`
 * object.
 *
 * These live HERE rather than beside `SelectOptionSchema` because the schema
 * module evaluates `Schema.Union(…)` at import time, so importing anything from
 * it drags the whole `effect` runtime into whatever bundle asks. The data-table
 * island needs exactly these three one-liners to render an option, and shipping
 * `effect` to the browser for them would be a payload regression under
 *(../../../docs/architecture/decisions/023-performance-first-default-ecoconception-opt-in.md).
 * `src/domain/utils/` is where the other browser-reachable domain helpers
 * already live (`substitute-record-vars`, `email-validation`).
 *
 * `SelectOptionSchema` imports its uniqueness check from here, so there is one
 * definition of "what an option's value is", not two.
 */

/**
 * The object form of a select option — structurally the object arm of
 * `SelectOptionSchema`. Declared independently of the schema so this module
 * stays `effect`-free; the schema's inferred type is assignable to it.
 */
export interface SelectOptionObject {
  readonly value: string
  readonly label?: string
  readonly color?: string
}

/** A select option in either authored form. */
export type SelectOptionLike = string | SelectOptionObject

/**
 * The option's stored/constraint VALUE. Use this everywhere the raw stored
 * value matters — CHECK constraints, DEFAULT clauses, DB storage, filtering,
 * `<option value>` — so an object option's label never leaks into a value
 * position.
 *
 * @example
 * ```typescript
 * optionValue('low')                           // 'low'
 * optionValue({ value: 'low', label: 'Low' })  // 'low'
 * ```
 */
export const optionValue = (option: SelectOptionLike): string =>
  typeof option === 'string' ? option : option.value

/**
 * The option's display LABEL, falling back to the value when none is set. The
 * returned label may be a `$t:` key; callers with a translation catalog in hand
 * resolve it (see `form-field-resolver.ts`), and callers without one render it
 * as-is.
 *
 * @example
 * ```typescript
 * optionLabel('low')                           // 'low'
 * optionLabel({ value: 'low', label: 'Low' })  // 'Low'
 * optionLabel({ value: 'low' })                // 'low' (falls back to value)
 * ```
 */
export const optionLabel = (option: SelectOptionLike): string =>
  typeof option === 'string' ? option : (option.label ?? option.value)

/**
 * The option's author-declared `#RRGGBB` fill, or `undefined` when the author
 * declared none.
 *
 * `undefined` is meaningful and must not be defaulted: an option with no colour
 * renders exactly as it did before colour existed
 * ([[internal ref] A7](../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * ruling 5 — this is an opt-in, not a repaint).
 *
 * @example
 * ```typescript
 * optionColor('low')                              // undefined
 * optionColor({ value: 'low' })                   // undefined
 * optionColor({ value: 'low', color: '#FDE68A' }) // '#FDE68A'
 * ```
 */
export const optionColor = (option: SelectOptionLike): string | undefined =>
  typeof option === 'string' ? undefined : option.color
