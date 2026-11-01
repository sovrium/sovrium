/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { normalizeRouteParamRef } from '@/domain/models/app/pages/route-param-ref'

/**
 * Family 1 of the page binding rules (families numbered at the head of `page-binding-validation.ts`, which runs
 * them for one page): every route-parameter
 * reference a page makes names a `:segment` its own `path` declares. Pure.
 */

/**
 * Every `$param.<name>` reference in a string, by the same name grammar the
 * route matcher captures. A single STATIC literal — never built from input
 * (`sovrium/no-dynamic-regexp`).
 */
const PARAM_REFERENCE = /\$param\.([A-Za-z_][A-Za-z0-9_]*)/g

/**
 * What every route-parameter rule needs to decide AND to report: the segments
 * the page's `path` declares, plus the two strings a violation message names.
 * Bundled because they always travel together and never independently.
 */
export interface RouteContext {
  readonly declared: ReadonlySet<string>
  readonly label: string
  readonly path: string
}

/**
 * Component types whose `dataSource.system` is the ROWS envelope — the ONLY
 * shape whose `param` is unambiguously a ROUTE parameter, and therefore the only
 * one this rule governs.
 *
 * `dataSource.system` is spelled identically by two DIFFERENT schemas, and their
 * `param` fields mean opposite things:
 *
 *  - `SystemSourceSchema` (rows envelope) — `param` names a `:segment` of the
 *    host page's `path`, substituted into the endpoint. A rows source has no
 *    bound record to take an id from, so a name the path does not declare is
 *    always a typo. GOVERNED.
 *  - `SystemDetailSourceSchema` (single record) — `param` names the endpoint's
 *    id SLOT, filled from the clicked row's id (`record-drawer`), the bound
 *    record (`record-field`), or `?record=`. It is unrelated to the page's path:
 *    a drawer on `/board` legitimately declares `param: 'id'`. NOT GOVERNED.
 *
 * The walk is structural (it cannot tell the two apart from the `system` object
 * alone — both carry `endpoint`, `param`, `idKey`, `query`, and the shipped
 * configs set none of the discriminating optional keys), so the CONSUMER's
 * `type` is what separates them. This list is therefore the component types that
 * accept `SystemSourceSchema`: `table` (via `DataTableSystemSourceSchema`,
 * an alias of it) plus the list family and `container` (via `dataBoundFields`).
 * `chart` and `kpi` keep their own specialized system sources, which declare no
 * `param` at all. The page-level `dataSource` is out of reach by construction —
 * only `components` and `layout` are walked — and so is the `app.systemSources[]`
 * catalogue, which is not part of a page.
 *
 * DIRECTION IS DELIBERATE: an allow-list, not a deny-list of the detail
 * consumers. A rows component added later and left off this list simply is not
 * checked (the pre-existing state); a detail consumer added later under a
 * deny-list would have every valid config REFUSED AT BOOT — which is exactly the
 * defect this scoping fixes, and it broke 8 shipped record-drawer specs plus the
 * CLI validation contract before it was caught.
 *
 * @see src/domain/models/app/pages/components/system-source.ts — the rows envelope
 * @see src/domain/models/app/pages/components/system-detail-source.ts — the single record
 * @see src/domain/models/app/pages/components/component-types/modules/data-bound.ts
 */
const ROWS_SOURCE_COMPONENT_TYPES: ReadonlySet<string> = new Set([
  ...['table', 'list', 'kanban', 'event-calendar', 'gallery', 'carousel', 'timeline'],
  'container',
])

/**
 * Every route-parameter reference reachable from the page must name a
 * `:segment` the page's `path` declares.
 */
export function routeParamViolations(
  nodes: readonly Record<string, unknown>[],
  strings: readonly string[],
  route: RouteContext
): readonly string[] {
  return [
    ...nodes.flatMap((node) => systemParamViolation(node, route.declared, route.label, route.path)),
    ...referenceParamViolations(nodes, strings, route),
  ]
}

/**
 * Every `$param.<name>` reference reachable as a STRING anywhere in the page.
 *
 * ─── WHY THE SCAN IS OVER STRINGS RATHER THAN OVER KNOWN KEYS ──────────────
 *
 * `$param.<name>` started life in `dataSource.filter[].value` and this rule
 * used to look only there. That was already the wrong shape and became visibly
 * so once the reference had to reach an action URL, a file upload target and an
 * island-hosted prop: enumerating the keys a route value is useful in means
 * this rule silently stops firing every time a new one is added — a validation
 * gap that fails exactly the way the thing it validates does, in silence.
 *
 * A string scan cannot go stale that way, and it is the same decision the
 * `$query.<name>` substitution pass already made on the resolution side
 * (`query-props-resolver.ts` walks every string leaf rather than a key list).
 * The two now agree: a reference is legal wherever a string is, and is checked
 * wherever a string is.
 *
 * The TYPED form `{ kind: 'routeParam', name }` is an object rather than a
 * string, so it is collected from the node walk instead — the two spellings are
 * equivalent by design and must be adjudicated identically.
 *
 * Names are deduplicated, so a page interpolating `$param.table` into a dozen
 * URLs reports the typo once rather than a dozen times.
 */
function referenceParamViolations(
  nodes: readonly Record<string, unknown>[],
  strings: readonly string[],
  { declared, label, path }: RouteContext
): readonly string[] {
  const fromStrings = strings
    .filter((value) => value.includes('$param.'))
    .flatMap((value) => [...value.matchAll(PARAM_REFERENCE)].map((match) => match[1]))
    .filter((name): name is string => name !== undefined)

  const fromTypedRefs = nodes
    .map((node) => normalizeRouteParamRef(node))
    .filter((ref) => ref !== undefined)
    .map((ref) => ref.name)

  return [...new Set([...fromStrings, ...fromTypedRefs])]
    .filter((name) => !declared.has(name))
    .toSorted((a, b) => a.localeCompare(b))
    .map(
      (name) =>
        `${label} references route param "$param.${name}" but its path "${path}" declares no ":${name}" segment`
    )
}

/**
 * `dataSource.system.param` — the rows-envelope ROUTE binding, and only that
 * one. Gated on the owning component's `type` because the detail envelope is
 * spelled the same way and means something else entirely
 * ({@link ROWS_SOURCE_COMPONENT_TYPES}), which is why this one takes the whole
 * NODE where its filter sibling takes the `dataSource`.
 */
function systemParamViolation(
  node: Readonly<Record<string, unknown>>,
  declared: ReadonlySet<string>,
  label: string,
  path: string
): readonly string[] {
  const { type, dataSource } = node
  if (typeof type !== 'string' || !ROWS_SOURCE_COMPONENT_TYPES.has(type)) return []
  if (!isRecord(dataSource)) return []

  const { system } = dataSource
  if (!isRecord(system)) return []
  const { param: name } = system
  if (typeof name !== 'string' || declared.has(name)) return []
  return [
    `${label} binds dataSource.system.param "${name}" but its path "${path}" declares no ":${name}" segment`,
  ]
}
