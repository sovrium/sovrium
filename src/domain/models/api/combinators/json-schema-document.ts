/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaRepresentation } from 'effect'

/**
 * `Schema.toJsonSchemaDocument`, minus Effect 4.0.0's conservative check export.
 *
 * Effect 4.0.0 (#8482) stopped exporting a check's exact constraint whenever
 * JSON Schema's Unicode semantics could, for SOME input, disagree with the
 * runtime check:
 *
 * - `isPattern` drops its `pattern` unless the RegExp carries the `u` flag —
 *   and none of Sovrium's do, so 394 of the 411 patterns in `app.json` and
 *   every pattern in the OpenAPI document disappeared, along with every
 *   `patternProperties` (a pattern-keyed record now reads
 *   `additionalProperties: true`, accepting any key);
 * - `isMinLength(n)` on a string exports `minLength: ceil(n / 2)`, and
 *   `isMaxLength` / `isBetweenLength` are marked approximate.
 *
 * The disagreement is real but narrow — an astral character counts as two
 * UTF-16 units at runtime and one code point in a validator — while the loss is
 * broad: an editor pointed at the published schema stops flagging a malformed
 * identifier, slug or colour. Sovrium's patterns are ASCII classes, for which
 * Unicode and non-Unicode matching agree. So the four checks get their
 * Effect 4.0.0-rc.108 export back: the exact pattern and the exact length.
 *
 * Only an APPROXIMATE result is upgraded. A check whose `toJsonSchema` was
 * overridden at the call site with an exact fragment keeps it untouched.
 */
export const toJsonSchemaDocument = (
  schema: Schema.Top,
  options?: Schema.ToJsonSchemaOptions
): ReturnType<typeof Schema.toJsonSchemaDocument> => {
  const representation = SchemaRepresentation.toRepresentation(
    Schema.toCodecJson(schema).ast,
    options
  )
  return SchemaRepresentation.toJsonSchemaDocument(
    restoreExactChecks(representation) as SchemaRepresentation.Document,
    options
  )
}

type JsonSchemaFragment = Readonly<Record<string, unknown>>
type CheckExport = (input: { readonly type?: unknown; readonly schemas: unknown }) => unknown

/** The exact rc.108 fragment for a check, given the node type it constrains. */
const exactFragment = (
  id: string,
  payload: Readonly<Record<string, unknown>>,
  type: unknown
): JsonSchemaFragment | undefined => {
  if (id === 'effect/schema/isPattern' && typeof payload['source'] === 'string') {
    return { pattern: payload['source'] }
  }
  if (type !== 'string') return undefined
  if (id === 'effect/schema/isMinLength') return { minLength: payload['minLength'] }
  if (id === 'effect/schema/isMaxLength') return { maxLength: payload['maxLength'] }
  if (id === 'effect/schema/isBetweenLength') {
    return { minLength: payload['minimum'], maxLength: payload['maximum'] }
  }
  return undefined
}

/** Effect marks a lossy export by returning `[fragment, true]`. */
const isApproximate = (result: unknown): boolean =>
  Array.isArray(result) && result.length === 2 && result[1] === true

const isPlainObject = (value: unknown): value is Readonly<Record<string, unknown>> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Wrap a check's export so an approximation of a known check becomes exact. */
const upgradeCheck = (
  check: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const { representation: descriptor, annotations } = check
  if (!isPlainObject(descriptor) || !isPlainObject(annotations)) return check
  const { id, payload } = descriptor
  const original = annotations['toJsonSchema']
  if (typeof id !== 'string' || !isPlainObject(payload) || typeof original !== 'function') {
    return check
  }
  if (exactFragment(id, payload, 'string') === undefined) return check
  const upgraded: CheckExport = (input) => {
    const result: unknown = (original as CheckExport)(input)
    if (!isApproximate(result)) return result
    return exactFragment(id, payload, input.type) ?? result
  }
  return { ...check, annotations: { ...annotations, toJsonSchema: upgraded } }
}

/**
 * Rebuild the representation document with every known check upgraded.
 *
 * The walk copies plain objects and arrays only and never descends into
 * `annotations`, whose values (defaults, examples, callbacks) are the caller's
 * and are passed through by reference.
 */
const restoreExactChecks = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(restoreExactChecks)
  if (!isPlainObject(node)) return node
  const rebuilt = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === 'annotations' ? value : restoreExactChecks(value),
    ])
  )
  return rebuilt['_tag'] === 'Filter' ? upgradeCheck(rebuilt) : rebuilt
}
