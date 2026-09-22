/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Effect Schema → JSON Schema, including the metadata Effect keeps beside the
 * type rather than in it.
 *
 * `toJsonSchemaDocument` alone loses annotations that live on a wrapper node —
 * a `decodeTo`, a union arm, an alias — so the variants are folded back in
 * before normalisation runs. `convert` is the whole conversion in one call.
 */

import { closeOverReferences, rewriteRefs } from './components-registry'
import { documentedSides } from './document-sides'
import { DEFS_REF_PREFIX, REF_DESCRIPTION_MARKER } from './markers'
import { REF_SIBLING_METADATA, emptyToNullable, inlineDefs, normalize } from './normalize'
import type { Components } from './components-registry'
import type { JsonSchema } from './markers'
import type { Schema } from 'effect'

/**
 * Collapse Effect's per-annotation body copies back onto one component.
 *
 * `recordSchema.describe('Updated record')` at a use site is, in Zod,
 * `allOf: [{ $ref: Record }, { description: … }]` — the component stays shared
 * and the wording stays local. Effect has no such composition: annotating an
 * identified schema emits a FULL DUPLICATE of its body carrying the new
 * wording, and the first duplicate encountered claims the clean name. Left
 * alone, `Record` is published with one caller's phrasing and every other use
 * site is inlined as an unnamed copy of the same object.
 *
 * So the duplicates are matched structurally — same body once metadata is set
 * aside — and folded back onto the declared name. What each variant added over
 * the schema's OWN annotations (read from the AST, the only place the base's
 * wording survives) is left beside the `$ref`, where
 * {@link composeRefSiblings} turns it into the `allOf` the 3.0 document had.
 *
 * Two declared names sharing one body are left alone: that is a modelling
 * question — two names for one schema — not a duplication to silently resolve.
 */
const foldMetadataVariants = (
  definitions: JsonSchema,
  body: JsonSchema,
  declared: ReadonlyMap<string, JsonSchema>
): { definitions: JsonSchema; body: JsonSchema } => {
  const withoutMetadata = (definition: JsonSchema): JsonSchema =>
    Object.fromEntries(
      Object.entries(definition).filter(([key]) => !REF_SIBLING_METADATA.has(key))
    ) as JsonSchema
  const metadataOf = (definition: JsonSchema): JsonSchema =>
    Object.fromEntries(
      Object.entries(definition).filter(([key]) => REF_SIBLING_METADATA.has(key))
    ) as JsonSchema

  // A marked description belongs to the reference, never to the schema. It is
  // the only signal that survives Effect's body duplication: the AST cannot say
  // which of two identical annotated nodes was the declaration, and the emitted
  // document has already folded the wording onto the definition.
  const splitDescription = (
    definition: JsonSchema
  ): { readonly base: JsonSchema; readonly marked: JsonSchema } => {
    const { description } = definition
    if (typeof description !== 'string' || !description.startsWith(REF_DESCRIPTION_MARKER)) {
      return { base: definition, marked: {} }
    }
    const { description: _marked, ...base } = definition
    return {
      base: base as JsonSchema,
      marked: { description: description.slice(REF_DESCRIPTION_MARKER.length) },
    }
  }

  // Grouped by body, so "two declared names share one shape" is a group of two
  // rather than a flag raised while filling a map.
  const declaredByBody = Object.groupBy(
    Object.entries(definitions).filter(([name]) => declared.has(name)),
    ([, definition]) => JSON.stringify(withoutMetadata(definition as JsonSchema))
  )
  const canonical = new Map(
    Object.entries(declaredByBody).flatMap(([key, group]) =>
      group?.length === 1 && group[0] !== undefined ? [[key, group[0][0]] as const] : []
    )
  )

  const variants = new Map(
    Object.entries(definitions).flatMap(([name, definition]) => {
      const target = canonical.get(JSON.stringify(withoutMetadata(definition as JsonSchema)))
      if (target === undefined) return []
      if (name !== target && declared.has(name)) return []
      const split = splitDescription(definition as JsonSchema)
      const base = metadataOf((declared.get(target) ?? {}) as JsonSchema)
      const extra = {
        ...Object.fromEntries(
          Object.entries(metadataOf(split.base)).filter(
            ([key, value]) => JSON.stringify(base[key]) !== JSON.stringify(value)
          )
        ),
        ...split.marked,
      } as JsonSchema
      return [[name, { target, extra }] as const]
    })
  )
  if ([...variants].every(([name, v]) => name === v.target && Object.keys(v.extra).length === 0)) {
    return { definitions, body }
  }

  const repoint = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(repoint)
    if (typeof value !== 'object' || value === null) return value
    const node = value as JsonSchema
    const ref = node['$ref']
    const name =
      typeof ref === 'string' && ref.startsWith(DEFS_REF_PREFIX)
        ? ref.slice(DEFS_REF_PREFIX.length)
        : undefined
    const variant = name === undefined ? undefined : variants.get(name)
    if (variant !== undefined) {
      const { $ref: _ref, ...siblings } = node
      return { ...siblings, ...variant.extra, $ref: `${DEFS_REF_PREFIX}${variant.target}` }
    }
    return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, repoint(child)]))
  }

  const folded = Object.fromEntries(
    Object.entries(definitions)
      .filter(([name]) => !variants.has(name) || variants.get(name)?.target === name)
      .map(([name, definition]) => {
        const variant = variants.get(name)
        if (variant === undefined) return [name, repoint(definition)]
        // The component keeps the schema's OWN wording; the variant's wording
        // belongs to the use site and travels with the `$ref`.
        const own = metadataOf(splitDescription(definition as JsonSchema).base)
        return [name, repoint({ ...withoutMetadata(definition as JsonSchema), ...own })]
      })
  )
  return { definitions: folded as JsonSchema, body: repoint(body) as JsonSchema }
}

/**
 * Convert an Effect Schema for a response or request-body position, HOISTING
 * every `identifier`-annotated sub-schema into `components/schemas`.
 *
 * Effect emits an annotated schema as a `$ref` into a sibling `definitions`
 * map; this rewrites those pointers into OpenAPI's component namespace and
 * hands the definitions back for registration. A schema with no `identifier`
 * anywhere yields an empty component map and an inline body — the same shape a
 * bare `z.object()` produces today.
 */
/**
 * Metadata a definition may carry alongside a `$ref` without ceasing to be a
 * pure alias. Anything else means the node adds structure of its own.
 */
const ALIAS_METADATA_KEYS: ReadonlySet<string> = new Set([
  'description',
  'title',
  'nullable',
  'deprecated',
  'default',
  'example',
  'examples',
])

/** The `$defs` name a definition merely points at, if that is all it does. */
const aliasTarget = (definition: JsonSchema): string | undefined => {
  const ref = definition['$ref']
  if (typeof ref !== 'string' || !ref.startsWith(DEFS_REF_PREFIX)) return undefined
  return Object.keys(definition).every((key) => key === '$ref' || ALIAS_METADATA_KEYS.has(key))
    ? ref.slice(DEFS_REF_PREFIX.length)
    : undefined
}

/**
 * Give a recursive schema back its declared name.
 *
 * `Schema.suspend` cannot be emitted in place, so Effect lifts the loop into a
 * GENERATED definition and leaves the annotated node as a bare alias to it —
 * then mints a second, identical alias for the reference the loop makes back to
 * itself. One `identifier: 'ViewFilterNode'` therefore arrives as three
 * definitions: `ViewFilterNode` -> `Union_` <- `ViewFilterNode_1`, of which only
 * the generated middle one carries a body.
 *
 * Inlining cannot resolve that, and the failure is silent rather than loud: the
 * body references the alias that references the body, so `inlineDefs`' cycle
 * guard stops and BOTH generated names survive into `components/schemas` as if
 * they were part of the published API. `Union_` is not an API concept.
 *
 * So adopt instead. When a declared definition is a bare alias to a generated
 * one, the generated body moves under the declared name and every reference to
 * the generated name — including the sibling alias — is repointed at it. The
 * result is the single self-referential component the Zod document published.
 *
 * Deliberately narrow: only a DECLARED name may adopt, only a GENERATED target
 * may be adopted, and the first declared claimant wins. Two declared aliases to
 * one target would be two names for one schema, which is a modelling question,
 * not something to resolve silently here.
 */
const adoptAliasedBodies = (
  definitions: JsonSchema,
  body: JsonSchema,
  declared: ReadonlySet<string>
): { definitions: JsonSchema; body: JsonSchema } => {
  const claims = Object.entries(definitions).flatMap(([name, definition]) => {
    if (!declared.has(name)) return []
    const target = aliasTarget(definition as JsonSchema)
    return target === undefined || declared.has(target) ? [] : [[name, target] as const]
  })
  // First claimant wins, so a target claimed twice keeps only its first name.
  const adoption = new Map(
    claims.filter(([, target], index) => claims.findIndex(([, t]) => t === target) === index)
  )
  if (adoption.size === 0) return { definitions, body }

  const adopted = [...adoption].map(([name, target]) => [target, name] as const)
  // Effect's duplicate alias points at the same target; it folds onto the same
  // declared name rather than surviving as a second component.
  const duplicates = Object.entries(definitions).flatMap(([name, definition]) => {
    if (declared.has(name) || adoption.has(name)) return []
    const target = aliasTarget(definition as JsonSchema)
    const claimed = adopted.find(([from]) => from === target)?.[1]
    return claimed === undefined || claimed === name ? [] : [[name, claimed] as const]
  })
  const rename = new Map([...adopted, ...duplicates])

  const repoint = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(repoint)
    if (typeof value !== 'object' || value === null) return value
    return Object.fromEntries(
      Object.entries(value as JsonSchema).map(([key, child]) => {
        if (key !== '$ref' || typeof child !== 'string') return [key, repoint(child)]
        const name = child.startsWith(DEFS_REF_PREFIX)
          ? child.slice(DEFS_REF_PREFIX.length)
          : undefined
        const adopted = name === undefined ? undefined : rename.get(name)
        return [key, adopted === undefined ? child : `${DEFS_REF_PREFIX}${adopted}`]
      })
    )
  }

  const merged = Object.fromEntries(
    Object.entries(definitions)
      .filter(([name]) => !rename.has(name))
      .map(([name, definition]) => {
        const target = adoption.get(name)
        if (target === undefined) return [name, repoint(definition)]
        // The alias' own metadata (the `description` a use site contributed)
        // survives the adoption; the body comes from the generated definition.
        const { $ref: _ref, ...metadata } = definition as JsonSchema
        return [name, repoint({ ...(definitions[target] as JsonSchema), ...metadata })]
      })
  )
  return { definitions: merged as JsonSchema, body: repoint(body) as JsonSchema }
}

export const convert = (schema: Schema.Top): { schema: JsonSchema; components: Components } => {
  const sides = documentedSides(schema)
  // Effect hoists into `$defs` for TWO reasons: an explicit `identifier`
  // annotation, and de-duplication of a repeated anonymous shape. Only the first
  // is a component anybody named. Publishing the second puts Effect's generated
  // key — `Objects_` — into `components/schemas` as if it were part of the API.
  // The declared names are read off the AST, the only place that distinction
  // survives; everything else is inlined, which is what Zod emitted for an
  // anonymous shape however many times it appeared.
  const annotated = declaredAnnotations(schema)
  const declared = new Set(annotated.keys())
  const adopted = adoptAliasedBodies(
    sides.definitions as JsonSchema,
    sides.schema as JsonSchema,
    declared
  )
  const { definitions, body } = foldMetadataVariants(adopted.definitions, adopted.body, annotated)
  const anonymous = Object.fromEntries(
    Object.entries(definitions as JsonSchema).filter(([name]) => !declared.has(name))
  )
  const components = Object.fromEntries(
    Object.entries(definitions as JsonSchema)
      .filter(([name]) => declared.has(name))
      .map(([name, definition]) => [
        name,
        normalize(rewriteRefs(inlineDefs(definition, anonymous, []))) as JsonSchema,
      ])
  )
  return {
    // Root position, like {@link effectSchema}: `normalize` applies
    // `emptyToNullable` on the way DOWN, so an unconstrained body or response
    // schema — a bare `Schema.Unknown` — is never itself reached by it.
    schema: normalize(
      emptyToNullable(rewriteRefs(inlineDefs(body as JsonSchema, anonymous, [])))
    ) as JsonSchema,
    // A kept definition can reference ANOTHER named one that the AST walk did
    // not surface — a nested identifier reached through a field. Closing the
    // set over the references the definitions themselves make is what keeps
    // those from dangling; filtering by the walk alone leaves a `$ref` pointing
    // at a component this fragment never carries.
    components: closeOverReferences(components, definitions as JsonSchema),
  }
}

/**
 * Every `identifier` annotation reachable from a schema.
 *
 * Walked off the AST rather than inferred from the emitted `$defs` keys, because
 * those two sets differ precisely where it matters: a generated key for a
 * de-duplicated anonymous shape is indistinguishable from a declared one once it
 * reaches JSON.
 */
/**
 * Every `identifier`-annotated node in the AST, mapped to its OWN annotations.
 *
 * The identifiers alone decide which `$defs` entries are real components. The
 * annotations beside them answer a second question the emitted document cannot:
 * whether a `description` on a definition belongs to the SCHEMA or to a use
 * site that annotated it. Effect erases that distinction — a use-site
 * `.annotate({ description })` emits a full duplicate of the body carrying the
 * new wording, and the first such duplicate encountered claims the clean name —
 * so one caller's phrasing silently relabels the shared component for everyone.
 * The AST is the only place the base's own wording survives.
 */
const declaredAnnotations = (schema: Schema.Top): ReadonlyMap<string, JsonSchema> => {
  const collect = (value: unknown, depth: number): readonly (readonly [string, JsonSchema])[] => {
    if (depth > 64 || value === null || typeof value !== 'object') return []
    if (Array.isArray(value)) return value.flatMap((item) => collect(item, depth + 1))
    const node = value as Record<string, unknown>
    const annotations = node['annotations'] as Record<string, unknown> | undefined
    const identifier = annotations?.['identifier']
    return [
      ...(typeof identifier === 'string'
        ? ([[identifier, (annotations ?? {}) as JsonSchema]] as const)
        : []),
      ...Object.values(node).flatMap((child) => collect(child, depth + 1)),
    ]
  }
  // Annotations MERGE, so the declaring node's set is a subset of every
  // variant's: the intersection over all occurrences of an identifier is
  // exactly what the schema itself declared. Taking the first or last
  // occurrence instead would hand the base whichever use site the walk reached
  // first — the same coin-flip the emitted document already makes.
  const occurrences = collect((schema as unknown as { ast?: unknown }).ast, 0)
  const byName = Object.groupBy(occurrences, ([name]) => name)
  return new Map(
    Object.entries(byName).flatMap(([name, group]) => {
      const sets = (group ?? []).map(([, annotations]) => annotations)
      const first = sets[0]
      if (first === undefined) return []
      const shared = Object.entries(first).filter(([key, value]) =>
        sets.every((other) => JSON.stringify(other[key]) === JSON.stringify(value))
      )
      return [[name, Object.fromEntries(shared) as JsonSchema] as const]
    })
  )
}
