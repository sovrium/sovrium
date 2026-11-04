/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One stable spelling of a JSON value, so that two parties hashing the same
 * value hash the same bytes.
 *
 * The rules follow the JSON Canonicalization Scheme (RFC 8785) for the values
 * a document of ours holds: no whitespace, object members sorted by key in
 * UTF-16 code-unit order, strings and numbers spelled as `JSON.stringify`
 * spells them (ECMAScript's own number serialisation, which is the one the
 * RFC adopts). An object member whose value is `undefined` is left out, as
 * `JSON.stringify` leaves it out, so an optional field that is absent and one
 * that was never declared spell the same.
 *
 * Pure: no clock, no randomness, no I/O.
 */

/** A value canonical JSON spells: what `JSON.parse` can produce. */
export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue | undefined }

/** Keys in UTF-16 code-unit order: the comparison `<` makes on strings. */
const byCodeUnits = (left: string, right: string): number => {
  if (left === right) return 0
  return left < right ? -1 : 1
}

/** The canonical spelling of `value`. A non-finite number spells `null`, as in `JSON.stringify`. */
export const canonicalJson = (value: CanonicalJsonValue): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    const items = value as readonly CanonicalJsonValue[]
    return `[${items.map(canonicalJson).join(',')}]`
  }
  const record = value as { readonly [key: string]: CanonicalJsonValue | undefined }
  const members = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .toSorted(byCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key] as CanonicalJsonValue)}`)
  return `{${members.join(',')}}`
}

/** The UTF-8 bytes of the canonical spelling of `value`: what a hash is taken over. */
export const canonicalJsonBytes = (value: CanonicalJsonValue): Uint8Array =>
  new TextEncoder().encode(canonicalJson(value))
