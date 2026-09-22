/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { RouteParamRef } from '@/domain/models/app/pages/components/data-source'

/**
 * Pure parser that converts the string-template sugar used in YAML / JSON
 * configs into a typed `RouteParamRef` discriminated-union value.
 *
 * Supported template:
 * - `$param.<name>` → `{ kind: 'routeParam', name: '<name>' }`
 *
 * This is the ROUTE-parameter sibling of `parseCurrentUserRef`
 * (`current-user-ref.ts`): both take a `$`-prefixed string a config author
 * writes in `dataSource.filter[].value` and hand back the typed reference the
 * request-time resolver reads. The difference is where the value comes from —
 * `$currentUser.*` from the authenticated session, `$param.*` from the matched
 * route pattern of the page being rendered.
 *
 * A `$param.` template naming a segment the page's `path` does not declare is a
 * DECODE error (see `collectPageBindingViolations`), so by the time a resolver
 * sees a `RouteParamRef` the name is guaranteed to be a declared segment.
 *
 * Returns `undefined` for any string that is not a recognized `$param`
 * template.
 */
export const parseRouteParamRef = (raw: unknown): RouteParamRef | undefined => {
  if (typeof raw !== 'string') return undefined
  if (!raw.startsWith('$param.')) return undefined

  const name = raw.slice('$param.'.length)
  // A bare `$param.` names nothing, and a dotted suffix (`$param.a.b`) would
  // imply a nested path a route parameter never has — both are non-references
  // rather than errors, exactly as an unrecognized `$currentUser.` suffix is.
  if (name.length === 0 || name.includes('.')) return undefined
  return { kind: 'routeParam', name }
}

/**
 * True when the provided value is already a typed route-parameter reference
 * (object form), or a string template that resolves to one.
 */
export const isRouteParamRef = (value: unknown): value is RouteParamRef | string =>
  isRouteParamRefObject(value) || parseRouteParamRef(value) !== undefined

/**
 * Normalizes either a typed ref object or its string-template sugar into a
 * single `RouteParamRef`. Returns `undefined` when the input is neither.
 */
export const normalizeRouteParamRef = (value: unknown): RouteParamRef | undefined => {
  if (isRouteParamRefObject(value)) return value
  return parseRouteParamRef(value)
}

/** Object-form guard: `{ kind: 'routeParam', name: string }`. */
const isRouteParamRefObject = (value: unknown): value is RouteParamRef =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  (value as { kind: unknown }).kind === 'routeParam' &&
  'name' in value &&
  typeof (value as { name: unknown }).name === 'string'
