/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The JSON Schema normalisation pipeline.
 *
 * `Schema.toJsonSchemaDocument` emits a draft-2020-12 document whose shape is
 * correct but not what an OpenAPI 3.1 consumer expects: `$defs` rather than
 * components, `allOf` wrappers around every refinement, `anyOf` branches for
 * absent keys. Each pass below fixes exactly one of those, and `normalize`
 * applies them in the one order that works.
 */

import {
  COMPONENT_REF_PREFIX,
  EXTENDS_MARKER_PREFIX,
  asSchemaNode,
  dropMarkerTitle,
  stripAdditionalProperties,
  stripOptionalUndefined,
} from './markers'
import type { JsonSchema } from './markers'

/**
 * Fold an `allOf` of pure keyword branches back into its parent.
 *
 * Effect emits each refinement as its own `allOf` branch, so
 * `check(isMinLength(1), isMaxLength(10))` becomes
 * `{ type: 'string', allOf: [{ minLength: 1 }, { maxLength: 10 }] }` where Zod
 * emits a flat `{ type: 'string', minLength: 1, maxLength: 10 }`.
 *
 * Folding is applied ONLY when every branch is a plain object and no keyword
 * appears twice — neither between two branches nor between a branch and the
 * parent. A collision means the branches genuinely intersect (two different
 * `minLength`s, say), and merging would silently drop one constraint, so the
 * `allOf` is left standing. Under the no-collision rule the merge is a pure
 * re-spelling: the set of asserted keywords is unchanged.
 */
const flattenAllOf = (schema: JsonSchema): JsonSchema => {
  const branches = schema['allOf']
  if (!Array.isArray(branches) || branches.length === 0) return schema
  const isPlainObject = (value: unknown): value is JsonSchema =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
  if (!branches.every(isPlainObject)) return schema
  // A `$ref` branch is a COMPOSITION, not a bag of keywords. Folding it would
  // erase the reference and inline nothing in its place.
  if (branches.some((branch) => '$ref' in branch)) return schema
  const { allOf: _folded, ...parent } = schema
  const merged = branches.reduce<JsonSchema | undefined>(
    (accumulator, branch) =>
      accumulator === undefined ||
      Object.keys(branch).some((key) => key in accumulator || key in parent)
        ? undefined
        : { ...accumulator, ...branch },
    {}
  )
  return merged === undefined ? schema : { ...parent, ...merged }
}

/**
 * Rebuild `allOf: [{ $ref }, { own fields }]` from the extends marker.
 *
 * Any sibling keyword the extending schema carried — a `description`, most
 * often — stays on the wrapper rather than moving into either branch, which is
 * where zod-to-openapi put it.
 */
const restoreExtendsComposition = (schema: JsonSchema): JsonSchema => {
  const { title } = schema
  if (typeof title !== 'string' || !title.startsWith(EXTENDS_MARKER_PREFIX)) return schema
  const [component, ownList] = title.slice(EXTENDS_MARKER_PREFIX.length).split('|own=')
  const own = new Set((ownList ?? '').split(',').filter((name) => name.length > 0))
  const {
    title: _marker,
    properties,
    required,
    type: _type,
    additionalProperties: _open,
    ...siblings
  } = schema
  const ownProperties = Object.fromEntries(
    Object.entries((properties ?? {}) as JsonSchema).filter(([name]) => own.has(name))
  )
  const ownRequired = (Array.isArray(required) ? required : []).filter(
    (name): name is string => typeof name === 'string' && own.has(name)
  )
  const reference = { $ref: `${COMPONENT_REF_PREFIX}${component ?? ''}` }
  if (own.size === 0) {
    // No own fields means the derived schema only re-describes the base — Zod's
    // `registeredSchema.describe('…')`, which it rendered as the reference plus
    // a description-only branch rather than by folding the description into the
    // shared component. Folding is what Effect does natively, and it is why the
    // same component reached two routes with two different descriptions.
    //
    // The node arrives as a one-member `anyOf` around the reference, because
    // that is the only wrapper that keeps the base's identifier in the AST: a
    // spread of its `.fields` copies the shape and drops the name, leaving this
    // very `$ref` pointing at a component the fragment no longer declares.
    const { description, anyOf: _wrapper, ...rest } = siblings
    return { allOf: [reference, ...(description === undefined ? [] : [{ description }])], ...rest }
  }
  return {
    allOf: [
      reference,
      {
        properties: ownProperties,
        ...(ownRequired.length > 0 ? { required: ownRequired } : {}),
        type: 'object',
      },
    ],
    ...siblings,
  }
}

/**
 * Substitute every `#/$defs/<name>` reference with the definition it names.
 *
 * A schema annotated with an `identifier` is emitted by Effect as a `$ref` into
 * a sibling `definitions` map. `$defs` is not an OpenAPI keyword, so left alone
 * the reference would dangle — Scalar renders an empty schema and generated
 * clients lose the type. Inlining is the whole fix.
 *
 * `visiting` carries the chain of names currently being expanded, which stops a
 * self-referential schema from expanding forever: a name already on the chain
 * is left as its `$ref`. That degrades to today's dangling-reference behaviour
 * for the recursive case rather than hanging the server, and no schema in this
 * group is recursive.
 */
export const inlineDefs = (
  value: unknown,
  definitions: JsonSchema,
  visiting: readonly string[]
): unknown => {
  if (Array.isArray(value)) return value.map((item) => inlineDefs(item, definitions, visiting))
  if (typeof value !== 'object' || value === null) return value
  const node = value as JsonSchema
  const reference = node['$ref']
  if (typeof reference === 'string' && reference.startsWith('#/$defs/')) {
    const name = reference.slice('#/$defs/'.length)
    const target = definitions[name]
    if (target === undefined || visiting.includes(name)) return node
    return inlineDefs(target, definitions, [...visiting, name])
  }
  return Object.fromEntries(
    Object.entries(node).map(([key, child]) => [key, inlineDefs(child, definitions, visiting)])
  )
}

/**
 * Render an EMPTY schema as `{ nullable: true }`.
 *
 * Effect emits `{}` for `Schema.Unknown` — correct JSON Schema for "any value".
 * zod-to-openapi's V3 generator spells the same thing `{ nullable: true }`,
 * which is what `z.unknown()` produced in the document today.
 *
 * Applied ONLY at positions that genuinely hold a schema. A blanket rule would
 * also rewrite an empty `properties: {}` map — which is a dictionary of
 * schemas, not a schema — and quietly invent a property called `nullable`.
 */
export const emptyToNullable = (schema: unknown): unknown => {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) return schema
  const keys = Object.keys(schema)
  // "Unconstrained" is about the STRUCTURE, not about the prose. A described
  // `Schema.Unknown` still constrains nothing, and the field would otherwise
  // gain a description and lose the `nullable` that says it accepts anything.
  return keys.every((key) => REF_SIBLING_METADATA.has(key))
    ? { ...(schema as JsonSchema), nullable: true }
    : schema
}

/**
 * Drop the `undefined` branch that `optionalField` adds, and its marker.
 *
 * Zod's `.optional()` accepts an ABSENT key and a PRESENT key holding
 * `undefined`, and emitted a bare `{ type: 'string' }` for both. Effect splits
 * those apart: `Schema.optionalKey` covers only the absent case, so
 * `optionalField` (`src/domain/models/api/combinators/optional-field.ts`) uses
 * `Schema.optional`, which is `optionalKey(UndefinedOr(S))`.
 *
 * That restores the runtime contract and CHANGES the document, because
 * `Schema.toJsonSchemaDocument` renders an `Undefined` member as
 * `{ "type": "null" }`. Left alone the field would publish
 * `anyOf: [{ type: 'string' }, { type: 'null' }]` — a claim that it accepts
 * `null`, which it does not, and which is indistinguishable from a genuine
 * `Schema.NullOr`. The two cannot be told apart structurally, which is why the
 * source marks its own: measured on effect 4.0.0-rc.108, an annotation on the
 * `Schema.Undefined` member is dropped by the emitter, so the marker rides on
 * the WRAPPER, where `title` survives.
 *
 * The `Undefined` member is always LAST — `UndefinedOr(S)` is `Union([S,
 * Undefined])` and unions do not flatten — and always exactly `{ type: 'null' }`,
 * so removing the final member is precise even when the inner schema is itself
 * nullable (`optionalField(Schema.NullOr(X))` correctly keeps its own null
 * branch) or is literally `Schema.Null`.
 *
 * The single surviving member is then merged up, so an optional field emits
 * exactly what its inner schema emits — which is what Zod published.
 */
/** Remove the marker from a node AND from every refinement branch it carries. */
export const cleanMarkers = (node: JsonSchema): JsonSchema => {
  const branches = node['allOf']
  if (!Array.isArray(branches)) return dropMarkerTitle(node)
  return dropMarkerTitle({
    ...node,
    allOf: branches.map((branch) => {
      const child = asSchemaNode(branch)
      return child === undefined ? branch : dropMarkerTitle(child)
    }),
  })
}

/** Keys whose value is itself a schema. */
const SCHEMA_VALUED_KEYS = new Set(['items', 'additionalProperties', 'not', 'contains'])

/** Keys whose value is an ARRAY of schemas. */
const SCHEMA_LIST_KEYS = new Set(['anyOf', 'allOf', 'oneOf', 'prefixItems'])

/**
 * Metadata that OpenAPI 3.0 ignores when it sits beside a `$ref`.
 */
export const REF_SIBLING_METADATA: ReadonlySet<string> = new Set([
  'description',
  'title',
  'deprecated',
  'default',
  'example',
  'examples',
])

/**
 * Re-express a described reference as `allOf`.
 *
 * In OpenAPI 3.0 a `$ref` is a REPLACEMENT, not a merge: any sibling keyword is
 * discarded by the reader. zod-to-openapi therefore compiled
 * `recordSchema.describe('Updated record')` — a description applied to an
 * already-registered component — into
 * `allOf: [{ $ref: Record }, { description: 'Updated record' }]`, which is the
 * only 3.0 spelling that survives.
 *
 * Effect expresses the same thing as a `$ref` with a sibling `description`, and
 * left alone it reads as a SILENT LOSS: the sibling is dropped by the consumer,
 * and — worse — Effect also folds the description onto the shared definition, so
 * one use site's wording would relabel the component for every other use.
 * Eight sites across `Record` and `UserWithRole` did exactly that.
 *
 * This is a 3.0-dialect artefact and one of the transforms the 3.1 switch
 * deletes: 3.1 permits `$ref` siblings outright.
 *
 * Runs LAST, on the already-normalized node. The branch it builds is metadata
 * only, and every other transform here treats a structure-free node as
 * unconstrained — `emptyToNullable` would stamp `nullable: true` onto a bare
 * description.
 */
const composeRefSiblings = (schema: JsonSchema): JsonSchema => {
  const ref = schema['$ref']
  if (typeof ref !== 'string') return schema
  const entries = Object.entries(schema).filter(([key]) => key !== '$ref')
  const metadata = entries.filter(([key]) => REF_SIBLING_METADATA.has(key))
  if (metadata.length === 0) return schema
  return {
    ...Object.fromEntries(entries.filter(([key]) => !REF_SIBLING_METADATA.has(key))),
    allOf: [{ $ref: ref }, Object.fromEntries(metadata)],
  }
}

/**
 * A property with a `default` is never required.
 *
 * `Schema.withDecodingDefaultKey` makes a key optional on the WIRE and present
 * in the decoded value, and the two sides disagree about `required` — which is
 * correct, and which the encoded-side rule in {@link mergeSides} already
 * resolves. It cannot resolve it under `preprocessed`, where the encoded side
 * is `Schema.Unknown` and carries no `required` at all to prefer, so the
 * decoded struct's list survives and publishes a defaulted field as mandatory.
 *
 * The invariant holds regardless of how the node was built: a client that may
 * omit a value BECAUSE the server supplies one cannot also be required to send
 * it. Zod never emitted the pair, and an OpenAPI reader that trusts `required`
 * would reject a body the API accepts.
 */
const defaultedKeysAreOptional = (schema: JsonSchema): JsonSchema => {
  const { required, properties } = schema
  if (!Array.isArray(required) || typeof properties !== 'object' || properties === null) {
    return schema
  }
  const kept = required.filter((name) => {
    const property = (properties as JsonSchema)[name as string]
    return (
      typeof property !== 'object' ||
      property === null ||
      (property as JsonSchema)['default'] === undefined
    )
  })
  if (kept.length === required.length) return schema
  const { required: _dropped, ...rest } = schema
  return kept.length === 0 ? rest : { ...rest, required: kept }
}

/**
 * Recursively normalize a JSON Schema tree.
 *
 * Position-aware on purpose: the transforms below apply to SCHEMAS, and a JSON
 * Schema document contains objects that are not schemas — `properties` is a map
 * of them, `required` is a list of strings. Walking blindly would rewrite those.
 */
export const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value !== 'object' || value === null) return value
  // `flattenAllOf` runs TWICE. The pre-3.1 reason (collapsing a nullable union
  // lifted a branch's `allOf` onto the node the FIRST pass had already visited)
  // is gone along with the collapse itself — a union's branches are each
  // normalized individually via the `anyOf` recursion below, so an inner
  // `allOf` is folded there. The second call here is now a no-op for
  // `restoreExtendsComposition`'s output specifically (its `allOf` always
  // carries a `$ref` branch, which `flattenAllOf`'s own guard refuses to fold)
  // and is kept rather than special-cased away, since removing it buys nothing
  // and a future producer of a foldable top-level `allOf` between the two
  // calls would otherwise go unfolded silently.
  const cleaned = flattenAllOf(
    restoreExtendsComposition(
      stripAdditionalProperties(flattenAllOf(stripOptionalUndefined(value as JsonSchema)))
    )
  )
  return composeRefSiblings(
    defaultedKeysAreOptional(
      Object.fromEntries(
        Object.entries(cleaned).map(([key, child]) => {
          if (key === 'properties' && typeof child === 'object' && child !== null) {
            return [
              key,
              Object.fromEntries(
                Object.entries(child as JsonSchema).map(([name, property]) => [
                  name,
                  normalize(emptyToNullable(property)),
                ])
              ),
            ]
          }
          if (SCHEMA_VALUED_KEYS.has(key)) return [key, normalize(emptyToNullable(child))]
          if (SCHEMA_LIST_KEYS.has(key) && Array.isArray(child)) {
            return [key, child.map((branch) => normalize(emptyToNullable(branch)))]
          }
          return [key, normalize(child)]
        })
      ) as JsonSchema
    )
  )
}
