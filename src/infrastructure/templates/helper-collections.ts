/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Array and object helper implementations.
 *
 * Every function here is total: an input of the wrong shape yields an empty
 * result rather than throwing, because a template that references a path which
 * did not resolve must render blank, not crash the automation run.
 */

import { toStr } from './helper-coercion'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/**
 * `{{flatten v}}` — ONE level deep, not recursive.
 *
 * Depth 1 is the honest default: a template author flattening a list of lists
 * wants the rows, and a fully-recursive flatten would silently dissolve nested
 * structure they may have meant to keep. Non-arrays pass through as a
 * single-element array so the helper composes with `{{join}}`.
 */
export const flatten = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value.flat(1) : [value]

/**
 * `{{reverseArray v}}` — non-mutating. `toReversed` rather than
 * `[...value].reverse()`: the spread copy would also be correct, but
 * `functional/immutable-data` rejects the `.reverse()` call regardless of what
 * it is called on, and the repo already prefers the `toSorted`/`toReversed`
 * family for exactly this reason.
 */
export const reverseArray = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value.toReversed() : []

/**
 * `{{count v}}` / `{{length v}}` — element count for an array, key count for an
 * object, character count for anything else. `count` is registered as an alias
 * of `length`; both names ship because both are what authors type.
 */
export const sizeOf = (value: unknown): number => {
  if (Array.isArray(value)) return value.length
  if (isPlainObject(value)) return Object.keys(value).length
  return toStr(value).length
}

/** `{{includes haystack needle}}` — string-compares members, like `contains`. */
export const includes = (haystack: unknown, needle: unknown): boolean =>
  Array.isArray(haystack)
    ? haystack.some((item) => toStr(item) === toStr(needle))
    : toStr(haystack).includes(toStr(needle))

/**
 * `{{pick obj "a" "b"}}` / `{{omit obj "a"}}` — object subsetting.
 *
 * A non-object input yields `{}` rather than being passed through: the caller
 * asked for a subset of keys, and echoing a string back would produce
 * `[object Object]`-class confusion downstream.
 */
export const pickKeys = (
  value: unknown,
  keys: readonly string[]
): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(value)) return {}
  const wanted = new Set(keys)
  return Object.fromEntries(Object.entries(value).filter(([key]) => wanted.has(key)))
}

export const omitKeys = (
  value: unknown,
  keys: readonly string[]
): Readonly<Record<string, unknown>> => {
  if (!isPlainObject(value)) return {}
  const unwanted = new Set(keys)
  return Object.fromEntries(Object.entries(value).filter(([key]) => !unwanted.has(key)))
}

/**
 * `{{get obj "a.b.c"}}` — dotted-path read, with numeric segments indexing
 * arrays.
 *
 * This exists because Handlebars' own `{{a.b.c}}` syntax requires the path to
 * be written LITERALLY in the template. `{{get obj somePathVariable}}` is the
 * only way to read a path that is itself computed — which is exactly what an
 * automation mapping a configurable field name needs.
 *
 * Returns "" for any segment that does not resolve, per the package contract.
 */
export const getPath = (source: unknown, path: string): unknown => {
  const segments = path.split('.').filter((segment) => segment !== '')
  return segments.reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      const index = Number(segment)
      return Number.isInteger(index) ? (current[index] ?? '') : ''
    }
    if (isPlainObject(current)) return current[segment] ?? ''
    return ''
  }, source)
}

/**
 * `{{switch value "a" "1" "b" "2" [fallback]}}` — positional case mapping.
 *
 * Pairs are consumed left to right; a trailing ODD operand is the default.
 * Chosen over a block-form `{{#switch}}` because the inline form composes
 * inside an interpolated string, which is where automation templates live.
 * No match and no default yields "".
 */
export const switchCase = (value: unknown, pairs: readonly unknown[]): unknown => {
  const subject = toStr(value)
  const pairCount = Math.floor(pairs.length / 2)
  const matched = Array.from({ length: pairCount }, (_, index) => index).find(
    (index) => toStr(pairs[index * 2]) === subject
  )
  if (matched !== undefined) return pairs[matched * 2 + 1] ?? ''
  return pairs.length % 2 === 1 ? (pairs[pairs.length - 1] ?? '') : ''
}
