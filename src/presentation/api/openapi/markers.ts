/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sentinel markers this adapter writes into an Effect Schema's annotations,
 * and the passes that consume them.
 *
 * A marker exists because JSON Schema cannot express something Effect Schema
 * can, so the information is smuggled through a `title` and stripped again
 * before the document ships. Each constant states what it smuggles; a pass that
 * reads one lives here beside it rather than in `normalize.ts`, so that adding
 * a marker and forgetting to strip it is a one-file mistake.
 */

import { OPTIONAL_UNDEFINED_MARKER } from '@/domain/models/api/combinators/optional-field'
import { cleanMarkers, emptyToNullable } from './normalize'

/** A JSON-Schema object as emitted by `Schema.toJsonSchemaDocument`. */
export type JsonSchema = Record<string, unknown>

/** The OpenAPI location every hoisted Effect schema is referenced from. */
export const COMPONENT_REF_PREFIX = '#/components/schemas/'

/** Effect's own `$defs` pointer prefix, rewritten to {@link COMPONENT_REF_PREFIX}. */
export const DEFS_REF_PREFIX = '#/$defs/'

/**
 * Marker asking for a node's INPUT shape instead. Mirrors
 * `DOCUMENT_INPUT_MARKER` in `domain/models/api/combinators/transform.ts`; declared
 * here rather than imported so the presentation-facing adapter does not reach
 * into a domain module for a string.
 */
const DOCUMENT_INPUT_MARKER = 'sovrium:document-input'

/**
 * Sentinel prefix marking a description contributed by a USE SITE.
 *
 * Written by `describedRef` in `domain/models/api/combinators/described-ref.ts`;
 * duplicated here for the same reason as {@link DOCUMENT_INPUT_MARKER} — the
 * infrastructure layer does not reach into domain for behaviour, and a marker
 * string is not worth a port. The two must move together.
 */
export const REF_DESCRIPTION_MARKER = 'sovrium:ref-description='

/**
 * Whether a node asked for its input shape.
 *
 * The marker may sit on the node or inside an `allOf` branch, because Effect
 * puts an annotation added after a refinement on the refinement — the same
 * ordering rule that governs descriptions. This runs BEFORE the allOf folding
 * that would otherwise lift it, so both placements are checked.
 */
export const findInputMarker = (node: JsonSchema): boolean =>
  node['title'] === DOCUMENT_INPUT_MARKER ||
  (Array.isArray(node['allOf']) &&
    (node['allOf'] as readonly unknown[]).some(
      (branch) =>
        typeof branch === 'object' &&
        branch !== null &&
        (branch as JsonSchema)['title'] === DOCUMENT_INPUT_MARKER
    ))

/**
 * Sentinel `title` marking a schema built by extending a registered component.
 *
 * Zod's `.extend()` on a `.openapi('Name')` schema emitted
 * `allOf: [{ $ref: Name }, { …own fields }]`, keeping the base visible by name.
 * Effect has no `allOf`, and spreading the base's `.fields` produces an
 * equivalent but FLAT object in which the base's reference has disappeared — a
 * structural change to a published contract.
 *
 * So the composition is rebuilt here from a marker carrying the base's
 * component name and the extending schema's OWN field names. The own names are
 * needed because the flattened node holds the base's fields too, and the second
 * branch must contain only what the extension added.
 *
 * Format: `sovrium:extends=<Component>|own=<a,b,c>`.
 */
export const EXTENDS_MARKER_PREFIX = 'sovrium:extends='

/** A JSON Schema node, as opposed to a `properties` map or a `required` list. */
export const asSchemaNode = (value: unknown): JsonSchema | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonSchema)
    : undefined

/** The rendering of a `Schema.Undefined` union member: a bare `{ type: 'null' }`. */
const isUndefinedBranch = (value: unknown): boolean => {
  const node = asSchemaNode(value)
  return node !== undefined && Object.keys(node).length === 1 && node['type'] === 'null'
}

/** Remove a `title` that is the marker, preserving the order of every other key. */
export const dropMarkerTitle = (node: JsonSchema): JsonSchema =>
  node['title'] === OPTIONAL_UNDEFINED_MARKER
    ? (Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'title')) as JsonSchema)
    : node

/**
 * Does this node carry the marker, in any of the three positions it can occupy?
 *
 * On the node itself (`optionalField`, which annotates the wrapper); or on a
 * refinement branch of it (`withDefault` applied AFTER a `check`, where Effect
 * lands a trailing `annotate` on the check rather than on the node — the same
 * rule recorded in `[internal ref]`).
 */
const carriesMarker = (node: JsonSchema | undefined): boolean => {
  if (node === undefined) return false
  if (node['title'] === OPTIONAL_UNDEFINED_MARKER) return true
  const branches = node['allOf']
  return (
    Array.isArray(branches) &&
    branches.some((branch) => asSchemaNode(branch)?.['title'] === OPTIONAL_UNDEFINED_MARKER)
  )
}

/**
 * Sentinel `title` marking a schema whose unknown-key rejection is REAL.
 *
 * Zod's `.strict()` both rejected at runtime and emitted
 * `additionalProperties: false`. An Effect struct emits that keyword for EVERY
 * struct while rejecting for none of them, so it is stripped by default — it
 * would otherwise document a rejection that does not happen. A schema carrying
 * a `strictKeys` annotation decodes with `onExcessProperty: 'error'` and earns
 * the keyword back; this sentinel is how that fact reaches the adapter, because
 * Effect passes no CUSTOM annotation through to JSON Schema and `title` is the
 * only carrier that survives — including through an array's `items`, which is
 * where the marked schemas here actually sit. It is removed before the document
 * is emitted, and `openapi-schema.test.ts` asserts it never ships.
 */
export const STRICT_KEYS_MARKER = 'sovrium:strict-keys'

/**
 * Sentinel `title` marking a struct that KEEPS unknown keys.
 *
 * The mirror of {@link STRICT_KEYS_MARKER}: `Schema.StructWithRest` replaces
 * Zod's `.passthrough()`, and both the runtime behaviour (aliases survive
 * decoding) and the published keyword depend on it. Two record-response schemas
 * carry it.
 */
export const OPEN_KEYS_MARKER = 'sovrium:open-keys'

/**
 * Drop `additionalProperties: false`, which Effect emits for every Struct.
 *
 * It is not merely a cosmetic difference from Zod — it is FALSE. Measured on
 * both libraries at the versions pinned here: given `{ content, extra }`
 * against a one-property object schema, `z.object().parse` returns
 * `{ content }` and `Schema.decodeUnknownResult` returns
 * `Success({ content })`. Neither rejects; both accept and strip. Publishing
 * `additionalProperties: false` would tell every generated client and every
 * Scalar reader that an extra key is a 400, when it is a 200.
 *
 * The distinction matters most where a body deliberately accepts an open shape
 * — `createRecordRequestSchema` takes an arbitrary flat field map — so this is
 * removed at the adapter rather than case by case.
 */
export const stripAdditionalProperties = (schema: JsonSchema): JsonSchema => {
  // The sentinel is removed unconditionally — it is an internal signal, and a
  // node can carry it without Effect having emitted `additionalProperties` at
  // all, in which case a branch that only cleaned up alongside the keyword
  // would publish `title: "sovrium:strict-keys"` into the document.
  const strict = schema['title'] === STRICT_KEYS_MARKER
  const { title: _sentinel, ...unmarked } = schema
  // Belt and braces for the OTHER sentinel: `stripOptionalUndefined` removes the
  // optional-undefined marker wherever it can reach it, but this runs AFTER
  // `flattenAllOf`, which lifts a refinement branch's keywords — the marker
  // included — onto the node. Removing it unconditionally here is what makes
  // "the marker never ships" a property of the pipeline rather than of one
  // function's coverage; `openapi-schema.test.ts` asserts it on the whole
  // document.
  const base = dropMarkerTitle(strict ? unmarked : schema)
  // An OPEN struct — `Schema.StructWithRest`, the `.passthrough()` replacement —
  // keeps the keys it does not name, and the 3.0 document said so with
  // `additionalProperties: { nullable: true }` (its rendering of "any value").
  // Effect omits the keyword entirely, but ABSENCE is not a usable signal: an
  // `allOf`-composed node omits it too, and inferring openness from silence put
  // the keyword on a component that rejects nothing and claims nothing. So the
  // intent is marked at the source, like {@link STRICT_KEYS_MARKER} next door.
  if (schema['title'] === OPEN_KEYS_MARKER) {
    const { title: _open, ...opened } = schema
    return { ...opened, additionalProperties: { nullable: true } }
  }
  if (base['additionalProperties'] !== false) return base
  // A schema that really DOES reject unknown keys keeps the keyword. An Effect
  // struct emits it for every struct while rejecting for none of them, so
  // without the marker the keyword would document a rejection that does not
  // happen. `openapi-schema.test.ts` asserts the sentinel never ships.
  if (strict) return base
  const { additionalProperties: _open, ...rest } = base
  return rest
}

/**
 * The VALUE member of a marked `anyOf: [T, { type: 'null' }]`, or `undefined`.
 *
 * `undefined` means the node is marked but not in the shape the collapse
 * expects, and the marker is then removed without touching the union — a
 * conservative outcome rather than a silent structural rewrite.
 */
const collapsibleValueBranch = (anyOf: unknown): JsonSchema | undefined => {
  if (!Array.isArray(anyOf) || anyOf.length !== 2) return undefined
  return isUndefinedBranch(anyOf[1]) ? asSchemaNode(anyOf[0]) : undefined
}

export const stripOptionalUndefined = (schema: JsonSchema): JsonSchema => {
  const { anyOf } = schema
  const first = Array.isArray(anyOf) ? asSchemaNode(anyOf[0]) : undefined
  if (schema['title'] !== OPTIONAL_UNDEFINED_MARKER && !carriesMarker(first)) return schema
  const siblings = dropMarkerTitle(
    Object.fromEntries(Object.entries(schema).filter(([key]) => key !== 'anyOf')) as JsonSchema
  )
  const value = collapsibleValueBranch(anyOf)
  if (value === undefined) return anyOf === undefined ? siblings : { ...siblings, anyOf }
  const kept = cleanMarkers(value)
  // `emptyToNullable` normally runs on the RAW property node, from the parent,
  // BEFORE this collapse — at which point the node still carries its `anyOf` and
  // reads as structured. An `optionalField(Schema.Unknown)` therefore reached
  // this point unstamped and left with a bare `{}` where the document has always
  // said `{ nullable: true }`. Re-running it on the collapsed node is what keeps
  // an unconstrained optional field byte-identical; it is idempotent, since the
  // `nullable` it adds is not itself metadata.
  //
  // A collision would mean the wrapper carried a keyword the inner schema also
  // sets; merging would silently drop one of them, so the union is left standing
  // minus its `undefined` branch rather than folded.
  return emptyToNullable(
    Object.keys(kept).some((key) => key in siblings)
      ? { ...siblings, anyOf: [kept] }
      : { ...kept, ...siblings }
  ) as JsonSchema
}
