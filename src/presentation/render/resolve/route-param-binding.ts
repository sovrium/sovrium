/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { normalizeRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

/**
 * Substitutes the matched route segments into a component's data binding, so a
 * SINGLE page definition reads a different collection per URL.
 *
 * Two independent bindings, both resolved here because both must be concrete
 * before anything downstream sees the component:
 *
 *  - `dataSource.system.param` fills the endpoint's `:placeholder`. This runs
 *    BEFORE `resolveIslandShortCircuit`, which serialises `dataSource` verbatim
 *    into `props._listIslandProps` — a substitution made later would arrive
 *    after the island had already been handed the literal `:group` and would
 *    request `/api/tables/:group/records`, a 404.
 *  - `dataSource.filter[].value` holding a `$param.<name>` reference (or its
 *    typed `{ kind: 'routeParam' }` form) becomes the matched value. It sits in
 *    the same position as `$currentUser.*` and resolves the same way, but from
 *    the matched route rather than the session — so it is resolved here rather
 *    than in `resolveCurrentUserFilters`, which needs a database round-trip and
 *    an authenticated session this binding has no use for.
 *
 * The name is guaranteed to be declared by the page's `path`:
 * `collectPageBindingViolations` refuses the config at DECODE time otherwise.
 * An absent value is therefore unreachable in practice — `patternToRegex`
 * captures `([^/]+)`, so a matched route never yields an empty segment. It is
 * still handled rather than thrown on: the endpoint keeps its placeholder (the
 * island reports a failed load) and the filter compares against the empty
 * string (which matches no row). Both degrade to "no rows", never to a 500.
 *
 * Pure: a new component is returned, the input is never mutated, and a
 * component with no route binding is returned unchanged by reference.
 */
export function bindRouteParams(
  component: Component,
  routeParams: Readonly<Record<string, string>>
): Component {
  const { dataSource } = component
  if (!dataSource) return component

  const system = substituteSystemEndpoint(dataSource, routeParams)
  const filter = substituteFilterRefs(dataSource.filter, routeParams)
  if (system === undefined && filter === undefined) return component

  return {
    ...component,
    dataSource: {
      ...dataSource,
      ...(system !== undefined ? { system } : {}),
      ...(filter !== undefined ? { filter } : {}),
    },
  } as Component
}

/**
 * Fills `:param` in a rows-envelope system endpoint from the matched route,
 * mirroring the client's `buildDetailEndpointUrl` (`use-system-source-fetch.ts`)
 * so both halves of the system-source family substitute identically.
 *
 * ONE deliberate difference: the value is NOT `encodeURIComponent`d. The detail
 * builder encodes because its id is a raw record field; this one's value is a
 * segment captured out of the request URL, so it is already percent-encoded and
 * encoding it again would turn `%20` into `%2520`.
 *
 * Returns `undefined` when there is nothing to substitute, which is what lets
 * the caller keep the component's identity for the overwhelmingly common case
 * of a static endpoint.
 */
function substituteSystemEndpoint(
  dataSource: NonNullable<Component['dataSource']>,
  routeParams: Readonly<Record<string, string>>
): Record<string, unknown> | undefined {
  const { system } = dataSource as { readonly system?: unknown }
  if (typeof system !== 'object' || system === null) return undefined

  const { param, endpoint } = system as { param?: unknown; endpoint?: unknown }
  if (typeof param !== 'string' || typeof endpoint !== 'string') return undefined

  const placeholder = `:${param}`
  const value = routeParams[param]
  if (value === undefined || !endpoint.includes(placeholder)) return undefined

  return { ...(system as Record<string, unknown>), endpoint: endpoint.replace(placeholder, value) }
}

/**
 * Replaces every `$param.<name>` filter value with the matched segment.
 *
 * Returns `undefined` when no filter carries a route reference, so a page whose
 * filters are all literals is untouched.
 */
function substituteFilterRefs(
  filter: readonly DataFilter[] | undefined,
  routeParams: Readonly<Record<string, string>>
): readonly DataFilter[] | undefined {
  if (!filter || filter.length === 0) return undefined
  if (!filter.some((condition) => normalizeRouteParamRef(condition.value) !== undefined)) {
    return undefined
  }

  return filter.map((condition) => {
    const ref = normalizeRouteParamRef(condition.value)
    if (!ref) return condition
    return { ...condition, value: routeParams[ref.name] ?? '' }
  })
}
