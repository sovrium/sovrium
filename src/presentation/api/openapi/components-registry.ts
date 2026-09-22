/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `components.schemas` registry: the named schemas a document hoists, and
 * the `$ref` rewriting that points at them.
 *
 * A schema reaches the registry by being named; everything else is inlined.
 * `closeOverReferences` is what keeps a hoisted schema's own references valid
 * once it has moved out of `$defs`.
 */

import { COMPONENT_REF_PREFIX, DEFS_REF_PREFIX } from './markers'
import { normalize } from './normalize'
import type { JsonSchema } from './markers'

/** Named schemas destined for the document's `components/schemas` map. */
export type Components = Readonly<Record<string, JsonSchema>>

/**
 * Symbol under which a fragment carries the named components it references.
 *
 * Deliberately a symbol and not a string key: `Object.entries`,
 * `JSON.stringify` and zod-to-openapi's traversals all skip symbol properties,
 * so a tagged fragment is byte-identical to an untagged one everywhere except
 * where this module reads it back.
 */
const COMPONENTS: unique symbol = Symbol('effect-openapi/components')

/**
 * Rewrite Effect's `#/$defs/X` pointers to OpenAPI's `#/components/schemas/X`.
 *
 * `$defs` is a JSON-Schema keyword with no meaning in an OpenAPI document — a
 * reference left pointing at it dangles, and Scalar renders an empty schema
 * where the type should be.
 */
export const rewriteRefs = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(rewriteRefs)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as JsonSchema).map(([key, child]) =>
      key === '$ref' && typeof child === 'string' && child.startsWith(DEFS_REF_PREFIX)
        ? [key, `${COMPONENT_REF_PREFIX}${child.slice(DEFS_REF_PREFIX.length)}`]
        : [key, rewriteRefs(child)]
    )
  )
}

/**
 * Pull in any definition a kept one references, until nothing is missing.
 *
 * Bounded by the size of `available`: each pass can only add names from it, and
 * a name is added at most once.
 */
export const closeOverReferences = (kept: Components, available: JsonSchema): Components => {
  const referenced = (value: unknown): readonly string[] => {
    if (Array.isArray(value)) return value.flatMap(referenced)
    if (typeof value !== 'object' || value === null) return []
    const node = value as JsonSchema
    const pointer = node['$ref']
    return typeof pointer === 'string' && pointer.startsWith(COMPONENT_REF_PREFIX)
      ? [pointer.slice(COMPONENT_REF_PREFIX.length)]
      : Object.values(node).flatMap(referenced)
  }
  const missing = [...new Set(referenced(kept))].filter(
    (name) => kept[name] === undefined && available[name] !== undefined
  )
  if (missing.length === 0) return kept
  return closeOverReferences(
    {
      ...kept,
      ...Object.fromEntries(
        missing.map((name) => [name, normalize(rewriteRefs(available[name])) as JsonSchema])
      ),
    },
    available
  )
}

/**
 * Tag a fragment with the components it references, for
 * {@link collectRouteComponents} to pick up at document-build time.
 */
export const withComponents = <T extends object>(fragment: T, components: Components): T =>
  Object.keys(components).length === 0 ? fragment : { ...fragment, [COMPONENTS]: components }

/** Read the components a fragment carries, if any. */
export const readComponents = (value: unknown): Components =>
  typeof value === 'object' && value !== null && COMPONENTS in value
    ? ((value as Record<symbol, Components>)[COMPONENTS] ?? {})
    : {}
