/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE place a data component's `$currentUser.*` filter becomes a concrete
 * value, for every component on the page wherever it sits.
 *
 * It runs over the whole tree BEFORE the data-source walk, the way
 * `bindRouteParams` fills `$param` before anything serialises a binding: the
 * island short-circuit (`resolveIslandShortCircuit`) and the nested island stamp
 * (`stampNestedChild`) both write `dataSource` into the island's props verbatim,
 * so a token still present there reaches the browser as a literal string and
 * matches no row. Resolving the tree first means neither of them — nor the
 * server-side mode resolvers — ever sees a `$currentUser` token.
 *
 * An anonymous request whose page holds such a filter at ANY depth answers 401,
 * exactly as a top-level one always has. Visibility has already pruned the tree
 * by the time this runs, so a subtree hidden from the session cannot trip it.
 */

import { resolveRelativeDatesIn } from '@/domain/models/app/pages/components/relative-date-filter'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import {
  componentField,
  componentFields,
  entryAsComponent,
  rewriteComponent,
  synthesizedComponent,
  tableBindingOf,
  type ComponentNode,
} from './component-rewrite'
import { hasCurrentUserRef, resolveFilters } from './current-user-resolver'
import { UNAUTHORIZED, type DataSourceDb } from './data-source-contracts'
import { bindRouteParams } from './route-param-binding'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/** What resolving a `$currentUser` reference needs about the request. */
export interface CurrentUserFilterContext {
  /**
   * The request's instant on a whole UTC minute — what a relative date token
   * resolves against: `$now-1h` this instant, `$today`, `$today+14d` and
   * `$startOfMonth` its UTC calendar day. Omitted: the tokens are left as written.
   */
  readonly now?: string
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly db: DataSourceDb
  readonly scopeTables: readonly string[]
  /**
   * The matched route's segments, for the bindings this pass resolves beyond a
   * component's own `dataSource` — a tab panel's `count`, whose `$param.<name>`
   * value no later walk reaches. Omitted: such a value is left as written.
   */
  readonly routeParams?: Readonly<Record<string, string>>
}

/**
 * Resolves `$currentUser.*` references inside `dataSource.filter[].value`,
 * returning a new component with concrete literal values. Returns
 * `UNAUTHORIZED` when an unauthenticated request hits a filter that
 * contains a `$currentUser` reference.
 *
 * - Unrestricted users (admin) bypass assignments-based filters entirely.
 * - `$currentUser.activeAssignment` requires `scopeTables` so the cookie
 *   value can be validated against the configured scope set
 *   (tamper-resistant — see current-user-resolver.ts).
 */
export async function resolveCurrentUserFilters(
  component: Component,
  ctx: CurrentUserFilterContext
): Promise<Component | typeof UNAUTHORIZED> {
  const dated = withRelativeDates(component, ctx.now)
  const binding = tableBindingOf(dated)
  const filters = binding?.filter
  if (!hasCurrentUserRef(filters)) return dated

  const result = await resolveFilters(filters, {
    session: ctx.session,
    cookies: ctx.cookies,
    fetchAssignments: ctx.db.fetchUserAssignments,
    scopeTables: ctx.scopeTables,
  })
  if (result.kind === 'unauthorized') return UNAUTHORIZED

  return rewriteComponent(dated, {
    dataSource: {
      ...binding,
      filter: result.filter,
    },
  })
}

/**
 * The component with every relative date token in its filter resolved to the
 * request's day (a `$now` token to its instant) — here, beside `$currentUser`, because both are
 * facts about the REQUEST that must be concrete before an island serialises
 * the binding for the browser. Returned by reference when there is nothing to
 * resolve.
 */
function withRelativeDates(component: Component, now: string | undefined): Component {
  const binding = tableBindingOf(component)
  const filter = binding?.filter
  if (now === undefined || filter === undefined) return component
  const resolved = resolveRelativeDatesIn(filter, now.slice(0, 10), now)
  return resolved === filter
    ? component
    : rewriteComponent(component, { dataSource: { ...binding, filter: resolved } })
}

/**
 * One tab panel's `count` binding, made concrete as a component's own is: each
 * `$param.<name>` the matched segment, each `$currentUser` reference and
 * relative date its value. The island reads the figure from the browser, so a
 * token left here would reach the aggregate route as literal text.
 *
 * `undefined` when the request has no session and the count needs one: the
 * figure is then not this reader's to know, so the panel draws its bare label
 * — a count is an ornament on a tab, and never makes the whole page 401.
 */
async function concreteCount(count: object, ctx: CurrentUserFilterContext): Promise<unknown> {
  const host = synthesizedComponent({ type: 'container', dataSource: count })
  const routed = ctx.routeParams === undefined ? host : bindRouteParams(host, ctx.routeParams)
  const resolved = await resolveCurrentUserFilters(routed, ctx)
  return resolved === UNAUTHORIZED ? undefined : (componentField(resolved, 'dataSource') ?? count)
}

/** A tab set's panels with every `count` made concrete; the node by reference when none changed. */
async function resolvePanelCounts(
  node: Component,
  ctx: CurrentUserFilterContext
): Promise<Component> {
  const { panels } = componentFields(node)
  if (!Array.isArray(panels)) return node
  const next = await Promise.all(
    panels.map(async (panel: unknown) => {
      if (typeof panel !== 'object' || panel === null) return panel
      const { count, ...rest } = componentFields(panel)
      if (typeof count !== 'object' || count === null) return panel
      const concrete = await concreteCount(count, ctx)
      if (concrete === count) return panel
      return concrete === undefined ? rest : { ...rest, count: concrete }
    })
  )
  return next.every((panel, index) => panel === panels[index])
    ? node
    : rewriteComponent(node, { panels: next })
}

type TreeNode = unknown
type Resolved = TreeNode | typeof UNAUTHORIZED

/** Resolve one list of nodes; any 401 wins. An unchanged list comes back by reference. */
async function resolveList(
  nodes: readonly TreeNode[],
  ctx: CurrentUserFilterContext
): Promise<readonly TreeNode[] | typeof UNAUTHORIZED> {
  const resolved = await Promise.all(nodes.map((node) => resolveNode(node, ctx)))
  if (resolved.some((node) => node === UNAUTHORIZED)) return UNAUTHORIZED
  return resolved.some((node, index) => node !== nodes[index]) ? resolved : nodes
}

/** Every `responsive.<breakpoint>.children`, resolved; `undefined` when nothing changed. */
async function resolveResponsive(
  responsive: unknown,
  ctx: CurrentUserFilterContext
): Promise<Record<string, unknown> | typeof UNAUTHORIZED | undefined> {
  if (typeof responsive !== 'object' || responsive === null) return undefined
  const entries: readonly (readonly [string, unknown])[] = Object.entries(responsive)
  const variants = await Promise.all(
    entries.map(async ([, variant]) => {
      if (typeof variant !== 'object' || variant === null) return variant
      const { children } = componentFields(variant)
      if (!Array.isArray(children)) return variant
      const resolved = await resolveList(children, ctx)
      if (resolved === UNAUTHORIZED) return UNAUTHORIZED
      return resolved === children ? variant : { ...variant, children: resolved }
    })
  )
  if (variants.some((variant) => variant === UNAUTHORIZED)) return UNAUTHORIZED
  if (variants.every((variant, index) => variant === entries[index]?.[1])) return undefined
  return Object.fromEntries(entries.map(([breakpoint], index) => [breakpoint, variants[index]]))
}

/** The node a `specimen` draws in `component`, resolved; a string there names a template. */
async function resolveDrawn(drawn: unknown, ctx: CurrentUserFilterContext): Promise<Resolved> {
  return typeof drawn === 'object' && drawn !== null ? resolveNode(drawn, ctx) : drawn
}

/** A node's descendants, resolved, as the patch to spread over it (empty when unchanged). */
async function resolveDescendants(
  node: Component,
  ctx: CurrentUserFilterContext
): Promise<Record<string, unknown> | typeof UNAUTHORIZED> {
  const { children, responsive, component: drawn } = componentFields(node)
  const [nextChildren, nextResponsive, nextDrawn] = await Promise.all([
    Array.isArray(children) ? resolveList(children, ctx) : children,
    resolveResponsive(responsive, ctx),
    resolveDrawn(drawn, ctx),
  ])
  if ([nextChildren, nextResponsive, nextDrawn].includes(UNAUTHORIZED)) return UNAUTHORIZED
  return {
    ...(nextChildren === children ? {} : { children: nextChildren }),
    ...(nextResponsive === undefined ? {} : { responsive: nextResponsive }),
    ...(nextDrawn === drawn ? {} : { component: nextDrawn }),
  }
}

/**
 * One node: its own filter, then its `children`, its breakpoint children, and
 * the node a `specimen` draws in `component`. A reference names a template and
 * is left alone. Identity-preserving when nothing below it changed.
 */
async function resolveNode(node: TreeNode, ctx: CurrentUserFilterContext): Promise<Resolved> {
  if (typeof node !== 'object' || node === null || isComponentReferenceNode(node)) return node
  const filtered = await resolveCurrentUserFilters(entryAsComponent(node as ComponentNode), ctx)
  if (filtered === UNAUTHORIZED) return UNAUTHORIZED
  const own = await resolvePanelCounts(filtered, ctx)
  const patch = await resolveDescendants(own, ctx)
  if (patch === UNAUTHORIZED) return UNAUTHORIZED
  if (own === node && Object.keys(patch).length === 0) return node
  return rewriteComponent(own, patch)
}

/**
 * Resolve every `$currentUser` filter in a page's component tree, or answer
 * `UNAUTHORIZED` when the request has no session and any of them needs one.
 */
export async function resolveCurrentUserFiltersInTree<T>(
  components: readonly T[],
  ctx: CurrentUserFilterContext
): Promise<readonly T[] | typeof UNAUTHORIZED> {
  return (await resolveList(components, ctx)) as readonly T[] | typeof UNAUTHORIZED
}
