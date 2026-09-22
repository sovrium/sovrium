/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Merging two `components.schemas` registries, and the one disagreement that
 * is not a conflict: the same schema named once nullable and once not.
 *
 * Every route contributes its own components and they are folded into one
 * document, so a name defined twice has to be reconciled rather than silently
 * overwritten by whichever route was chained last.
 */

import { readComponents } from './components-registry'
import type { Components } from './components-registry'
import type { JsonSchema } from './markers'

/**
 * Merge component maps, refusing two DISTINCT schemas that claim one name.
 *
 * This is the whole point of the hoisting channel. Effect keys `$defs` by the
 * `identifier` annotation, and when two schemas share one, **one silently wins
 * and the loser's entire subtree vanishes** — no error, no warning, a valid
 * document. That is not hypothetical: `identifier: 'Action'` was declared twice
 * in `src/domain/models/app/`, and the published JSON Schema lost the entire
 * 21-variant automation action vocabulary until it was found by hand.
 *
 * The same name carrying the same definition is legal and common — several
 * route groups reference `ErrorResponse` — so equality is compared on content,
 * not on identity.
 *
 * It throws, and it throws at document-build time, which for a served instance
 * means boot. That is the intended severity: a collision is a programming error
 * whose alternative failure mode is silent data loss in a published contract,
 * so refusing to produce a document at all is strictly safer than producing a
 * wrong one.
 */
/**
 * Two definitions that differ ONLY by a `nullable: true` or a use-site
 * `description`.
 *
 * The `nullable` half is now VESTIGIAL — nothing in this module emits that
 * keyword any more, since OpenAPI 3.1 has no such keyword and a nullable
 * union stays spelled out as `anyOf: [X, { type: 'null' }]` — but it is left
 * in place because a stale component-definition comparison would be silently
 * WRONG rather than merely unreachable if a future producer reintroduced the
 * key without updating this reconciliation. The `description` half stays
 * load-bearing: two route groups can still describe the same identifier
 * differently, and reconciling toward the described form is what stops that
 * from being reported as a genuine collision.
 */
const differsOnlyByNullable = (left: JsonSchema, right: JsonSchema): boolean => {
  const { nullable: _l, description: _ld, ...leftRest } = left
  const { nullable: _r, description: _rd, ...rightRest } = right
  return JSON.stringify(leftRest) === JSON.stringify(rightRest)
}

/**
 * Merge two reconcilable definitions, keeping whichever facts either one has.
 *
 * `nullable` because one nullable use site marks the shared component nullable;
 * `description` because a use-site description folds onto the component, so a
 * route that describes it and a route that does not produce two definitions.
 * Keeping the described one is what stops the description disappearing from the
 * document altogether — zod-to-openapi kept it by wrapping the reference at the
 * use site instead, which Effect cannot express.
 */
const reconcileNullable = (left: JsonSchema, right: JsonSchema): JsonSchema => {
  // One definition is chosen WHOLE and the two reconcilable facts are layered
  // on top. Merging the two key sets instead unions keys that differ for
  // unrelated reasons, which is how an `additionalProperties: false` from one
  // fragment appeared on a schema the other fragment documents as open.
  const base = left['nullable'] === true ? left : right
  const description = left['description'] ?? right['description']
  return {
    ...base,
    ...(left['nullable'] === true || right['nullable'] === true ? { nullable: true } : {}),
    ...(typeof description === 'string' ? { description } : {}),
  }
}

export const mergeComponents = (maps: readonly Components[]): Components =>
  maps.reduce<Components>((accumulated, map) => {
    const conflicts = Object.keys(map).filter((name) => {
      const existing = accumulated[name]
      const incoming = map[name]
      if (existing === undefined || incoming === undefined) return false
      if (JSON.stringify(existing) === JSON.stringify(incoming)) return false
      return !differsOnlyByNullable(existing, incoming)
    })
    if (conflicts.length > 0) {
      // A component-name collision silently erases one schema's subtree from the
      // published document (see the doc comment above). Refusing to build the
      // document at all is the point: no caller could meaningfully recover, and
      // returning a partial document would reproduce the exact bug this detects.
      // eslint-disable-next-line functional/no-throw-statements -- see above
      throw new Error(
        `OpenAPI component name collision: ${conflicts.join(', ')} — two different schemas ` +
          'claim the same `identifier`. Effect keys $defs by identifier, so one would ' +
          'silently overwrite the other and its whole subtree would vanish from the ' +
          'document. Rename one of them.'
      )
    }
    return Object.entries(map).reduce<Components>((merged, [name, definition]) => {
      const existing = merged[name]
      return {
        ...merged,
        [name]: existing === undefined ? definition : reconcileNullable(existing, definition),
      }
    }, accumulated)
  }, {})

/**
 * The three positions of a route that can carry components.
 *
 * Deliberately structural rather than `RouteSpec`: this function reads exactly
 * these three fields, and saying so lets a caller — a test, or a future spec
 * shape — pass what it has instead of constructing a whole route.
 */
type ComponentBearingRoute = {
  readonly responses?: Readonly<Record<string | number, unknown>>
  readonly request?: { readonly body?: unknown }
  readonly parameters?: readonly unknown[]
}

/**
 * Gather every named component referenced by one route spec.
 *
 * Walks the three positions a fragment can occupy — responses, request body,
 * and `parameters[]` — reading the symbol each helper attached.
 */
export const collectRouteComponents = (spec: ComponentBearingRoute): Components =>
  mergeComponents([
    ...Object.values(spec.responses ?? {}).map(readComponents),
    readComponents(spec.request?.body),
    ...(spec.parameters ?? []).map(readComponents),
  ])
