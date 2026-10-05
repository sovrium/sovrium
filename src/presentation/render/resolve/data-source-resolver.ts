/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-component data-source resolution pass over a page.
 *
 * `resolvePageDataSources` walks a page's components and hands each one to
 * `resolveComponent`, which is the ORDER the stages run in: desugar the binding,
 * stamp a nested island, resolve the render plan, validate the prerequisites,
 * then dispatch to the mode resolver. The `$currentUser` filters of the whole
 * tree are resolved once, before the walk (`current-user-filter-pass.ts`). Each
 * stage lives in a sibling module — the shared vocabulary in
 * `data-source-contracts.ts`, `$record` substitution in `record-substitution.ts`,
 * the per-row expansion and island stamps in `data-source-rows.ts`, the mode
 * resolvers in `data-source-modes.ts` — so this file is the sequence and the
 * page-level walk, and nothing else.
 */

import { utcCalendarDay } from '@/domain/models/app/pages/components/relative-date-filter'
import { serverNow } from '@/domain/models/process-env/dev-clock'
import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import { withCallerTableView } from './caller-table-stamp'
import { resolveCurrentUserFiltersInTree } from './current-user-filter-pass'
import { scopeTablesOf } from './current-user-resolver'
import {
  desugarSystemSourceRef,
  SINGLE_RECORD_NOT_FOUND,
  UNAUTHORIZED,
  withDataSourceError,
  type DataSourceDb,
  type DataSourceSectionResult,
} from './data-source-contracts'
import {
  checkFieldErrors,
  denyWhenUnreadable,
  gateNestedInheritedRecord,
  gateNestedTableBinding,
  holdsInheritedRecord,
  resolveByMode,
  resolveRenderPlan,
} from './data-source-modes'
import { resolveIslandShortCircuit, stampNestedIslands } from './data-source-rows'
import { bindRouteParams } from './route-param-binding'
import { isDroppedWithheld } from './withheld-component'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { ReadAccessPlan, TableLike } from '@/domain/models/app/tables/read-access-plan-service'

/** Validates prerequisites: table existence and read permissions. */
function validateDataSourcePrereqs(
  component: Component,
  ctx: {
    readonly matchedTable: ReturnType<NonNullable<App['tables']>['find']>
    readonly tableName: string
    readonly plan: ReadAccessPlan | undefined
  }
): Component | undefined {
  if (!ctx.matchedTable) {
    return withDataSourceError(component, `Error: table "${ctx.tableName}" not found`)
  }
  return denyWhenUnreadable(component, ctx.plan)
}

/** A `table` component whose `dataSource.view` names a view of a table that exists. */
function readsThroughDeclaredView(component: Component, matchedTable: unknown): boolean {
  return (
    matchedTable !== undefined &&
    component.type === 'table' &&
    component.dataSource?.view !== undefined
  )
}

async function resolveComponent(
  item: Component | SimpleComponentReference | ComponentReference,
  ctx: {
    readonly app: App
    readonly routeParams: Readonly<Record<string, string>>
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>> | undefined
    readonly db: DataSourceDb
  }
): Promise<DataSourceSectionResult> {
  const { app, routeParams, session, db } = ctx
  // Value-keyed, for the reason given on `stampNestedChild`: a top-level
  // `specimen` must reach the island walk below rather than being mistaken for
  // a template reference. It carries no `dataSource` of its own, so all it
  // gains is the descent — the type page draws its specimen here.
  if (isComponentReferenceNode(item)) return item
  // CAP-4: desugar a `{ systemSource: <name> }` catalog reference into the inline
  // `{ system: <entry> }` binding FIRST, so the rest of resolution (and every
  // downstream island) only ever deals with the inline system shape.
  // P1: fill the matched route segments into the binding — the endpoint's
  // `:placeholder` (`system.param`) and any `$param.<name>` filter value —
  // BEFORE the island short-circuit below serialises `dataSource` for the
  // client, which would otherwise hand the island a literal `:group`.
  const component = bindRouteParams(desugarSystemSourceRef(item as Component, app), routeParams)
  // A layout container carries no binding of its own, but may HOST one: descend
  // to stamp the island props of any data-bound descendant whose island-ness is
  // decided here rather than by its component type (a `list`, above all).
  if (!component.dataSource) {
    return resolveNestedSingleRecords(stampNestedIslands(component, { app, routeParams }), ctx)
  }

  // CAP-1/CAP-2: a client-fetching data-bound component (a `list` itemTemplate
  // binding, or a `record-field` self-binding to a system DETAIL endpoint) is
  // stamped for its island and SKIPS server-side resolution + app.tables
  // cross-validation — the island owns the fetch.
  const islandStamped = resolveIslandShortCircuit(component, routeParams, app)
  if (islandStamped) return islandStamped

  const { table: tableName, fields: requestedFields } = component.dataSource
  const matchedTable = (app.tables ?? []).find((t) => t.name === tableName)
  // A grid bound to one of its table's VIEWS reads through the view's own
  // records route, and it is that route's grant — the VIEW's, under which a
  // public view admits a visitor with no account — that decides what it
  // serves. The table's read plan is therefore not this binding's gate: asking
  // it would empty a public view's grid for exactly the reader it exists for.
  // Nothing is resolved here either; the island owns the fetch, read-only.
  // The page still names only what the view's route serves its reader: the
  // stamp carries that route's answer (`caller-table-stamp.ts`).
  if (readsThroughDeclaredView(component, matchedTable)) return withCallerTableView(component, ctx)
  const plan = resolveRenderPlan({
    matchedTable: matchedTable as TableLike | undefined,
    app,
    session,
  })
  const prereqResult = validateDataSourcePrereqs(component, { matchedTable, tableName, plan })
  if (prereqResult) return prereqResult

  const fieldError = checkFieldErrors(component, tableName, requestedFields, matchedTable!.fields)
  if (fieldError) return fieldError

  // A TABLE-bound record drawer picks its record at runtime, so there is nothing
  // here for the server to resolve it against. Its id arrives on a
  // `sovrium:open-drawer` dispatch or a `?record=` deep link, both of which the
  // island reads — which is why the SYSTEM-bound drawer short-circuits above,
  // and the reason applies to this one unchanged.
  //
  // Left to fall through, it reached `resolveSingleMode`, whose no-route-param
  // fallback fetches the table's FIRST row and substitutes it into the
  // component. For a detail page that fallback is what makes a static path work;
  // for a drawer it is a guess, and the wrong one for every row but one — the
  // author's `children` came back carrying row 1's values whichever row the
  // reader opened, and a childless drawer came back carrying a synthesized
  // `favorites-button` for a record it is not bound to.
  //
  // The short-circuit sits AFTER the two validations rather than beside its
  // system sibling, deliberately: a table binding names a declared table, so
  // "table not found", the read-permission gate and the field check all still
  // apply. Only the per-record resolution is skipped.
  if (component.type === 'drawer') return withCallerTableView(component, ctx)

  // Z-1 / P-6: `$currentUser.*` filters were resolved for the whole tree
  // before this walk began (`resolveCurrentUserFiltersInTree`), so the
  // binding here already carries concrete values.
  return resolveByMode({
    component,
    app,
    table: matchedTable!,
    session,
    routeParams,
    db,
    plan,
  })
}

type ResolveContext = Parameters<typeof resolveComponent>[1]

/**
 * A record-bound (`mode: 'single'`) component resolves the SAME wherever it is
 * placed — inline, or one container down.
 *
 * The walk above resolves a binding server-side at the top level only, and
 * stamps nested bindings for their islands (`stampNestedIslands`). That is
 * right for a list or a table, whose island owns its fetch; it is wrong for a
 * single-record binding, which has no island fetch at all — its record is read
 * here or not at all. A form bound to one record and wrapped in a layout
 * container therefore rendered its fields blank, and a Save would have written
 * those blanks over the record.
 *
 * So this descends through layout containers (nodes with no binding of their
 * own) and hands each nested `mode: 'single'` node to the same resolver the
 * top level uses. Every other nested binding is left exactly as the island
 * stamp returned it, and a bound node's own children — its per-row template —
 * are never entered. A nested record that does not exist answers the page the
 * way the same form written inline does.
 *
 * The same walk applies a nested table grid's read and write gates
 * (`gateNestedTableBinding`), for the same reason: it is the one nested pass
 * that holds the session, and a grid must answer the caller the same way
 * wherever it sits.
 *
 * Identity-preserving: a subtree with nothing to resolve comes back by reference.
 */
function isRecordBound(node: Component, routeParams: Readonly<Record<string, string>>): boolean {
  const binding = node.dataSource as { readonly mode?: string; readonly table?: unknown }
  return (
    binding.mode === 'single' &&
    typeof binding.table === 'string' &&
    resolveIslandShortCircuit(node, routeParams) === undefined
  )
}

/**
 * A section whose rows are drawn HERE, from its per-row `children` template —
 * a container of cards bound to a table. At the top of a page the walk above
 * expands it; one container down it used to ship its template once, with the
 * raw `$record.` text, so it is resolved the same way wherever it sits. A grid
 * (gated by `gateNestedTableBinding`), a drawer and an island binding (whose
 * island owns the fetch) are not.
 */
function drawsRowsOnServer(node: Component, ctx: ResolveContext): boolean {
  const binding = node.dataSource as { readonly mode?: string; readonly table?: unknown }
  const children = node.children as readonly unknown[] | undefined
  return (
    node.type !== 'table' &&
    node.type !== 'drawer' &&
    (binding.mode === undefined || binding.mode === 'list') &&
    typeof binding.table === 'string' &&
    children !== undefined &&
    children.length > 0 &&
    resolveIslandShortCircuit(node, ctx.routeParams, ctx.app) === undefined
  )
}

type NestedChild = Component | ComponentReference | string
type NestedResult = DataSourceSectionResult | string
type PageSentinel = typeof UNAUTHORIZED | typeof SINGLE_RECORD_NOT_FOUND

const isSentinel = (value: unknown): value is PageSentinel =>
  value === UNAUTHORIZED || value === SINGLE_RECORD_NOT_FOUND

/** One nested child: descend a container, resolve a record, gate a grid. */
async function resolveNestedChild(child: NestedChild, ctx: ResolveContext): Promise<NestedResult> {
  if (typeof child === 'string' || isComponentReferenceNode(child)) return child
  const node = child as Component
  if (!node.dataSource) return resolveNestedSingleRecords(node, ctx)
  if (isRecordBound(node, ctx.routeParams)) return resolveComponent(node, ctx)
  if (drawsRowsOnServer(node, ctx)) return resolveComponent(node, ctx)
  if (holdsInheritedRecord(node)) return gateNestedInheritedRecord(node, ctx)
  return withCallerTableView(gateNestedTableBinding(node, ctx), ctx)
}

/**
 * Resolve one child list; the page-level sentinel wins over any tree. An
 * unchanged list comes back by reference.
 */
async function resolveNestedList(
  children: readonly NestedChild[],
  ctx: ResolveContext
): Promise<readonly NestedResult[] | PageSentinel> {
  const resolved = await Promise.all(children.map((child) => resolveNestedChild(child, ctx)))
  const sentinel = resolved.find(isSentinel)
  if (sentinel !== undefined) return sentinel
  if (!resolved.some((child, index) => child !== children[index])) return children
  return resolved.filter((child) => !isDroppedWithheld(child))
}

/**
 * The same walk over every `responsive.<bp>.children`. A breakpoint's children
 * are drawn server-side like the node's own (and reference expansion already
 * inlines templates there), so a grid placed in one must answer the same gates
 * as the grid written in `children`.
 */
async function resolveNestedResponsive(
  host: Component,
  ctx: ResolveContext
): Promise<DataSourceSectionResult> {
  const { responsive } = host as { readonly responsive?: unknown }
  if (typeof responsive !== 'object' || responsive === null) return host
  const entries = Object.entries(responsive as Record<string, unknown>)
  const variants = await Promise.all(
    entries.map(async ([, variant]) => {
      const { children } = (variant ?? {}) as { readonly children?: unknown }
      if (!Array.isArray(children) || children.length === 0) return variant
      const resolved = await resolveNestedList(children as readonly NestedChild[], ctx)
      if (isSentinel(resolved)) return resolved
      return resolved === children
        ? variant
        : { ...(variant as Record<string, unknown>), children: resolved }
    })
  )
  const sentinel = variants.find(isSentinel)
  if (sentinel !== undefined) return sentinel
  if (variants.every((variant, index) => variant === entries[index]?.[1])) return host
  const next = Object.fromEntries(entries.map(([breakpoint], i) => [breakpoint, variants[i]]))
  return { ...host, responsive: next } as unknown as Component
}

/**
 * A node with no binding of its own. A form that creates a record is stamped
 * with the table it creates in, as its reader may see it, wherever it sits —
 * its inputs are drawn from that answer (`buildCreateFieldDefs`).
 */
async function resolveNestedSingleRecords(
  unbound: Component,
  ctx: ResolveContext
): Promise<DataSourceSectionResult> {
  const host = unbound.type === 'form' ? await withCallerTableView(unbound, ctx) : unbound
  const children = host.children as ReadonlyArray<NestedChild> | undefined
  const own = children && children.length > 0 ? await resolveNestedList(children, ctx) : children
  if (isSentinel(own)) return own
  const withOwn = own === children ? host : ({ ...host, children: own } as Component)
  return resolveNestedResponsive(withOwn, ctx)
}

/**
 * Resolves dataSource bindings for a page.
 *
 * Database access is provided via the `db` parameter (dependency injection)
 * to keep the presentation layer free of infrastructure dependencies.
 *
 * Returns:
 * - `undefined` when a single-mode dataSource finds no matching record (→ 404).
 * - `{ unauthorized: true }` when any component on the page declares a
 *   `$currentUser.*` filter and the request has no session (Z-1 → 401).
 * - The resolved `Page` otherwise.
 */
export async function resolvePageDataSources(
  page: Page,
  app: App,
  routeParams: Readonly<Record<string, string>>,
  ctx: {
    readonly session: SessionInfo | undefined
    readonly cookies?: Readonly<Record<string, string>>
    readonly db: DataSourceDb
  }
): Promise<Page | { readonly unauthorized: true } | undefined> {
  if (!page.components || page.components.length === 0) return page
  // Z-1 / [internal ref]: every `$currentUser.*` filter on the page, at any depth,
  // becomes a concrete value here — before the island stamps serialise a
  // binding for the browser. An anonymous request whose page needs one is 401.
  const components = await resolveCurrentUserFiltersInTree(page.components, {
    // [internal ref]: relative date tokens in a filter name a day of THIS request.
    // `SOVRIUM_DEV_CLOCK` pins it on a development server.
    today: utcCalendarDay(serverNow()),
    session: ctx.session,
    cookies: ctx.cookies,
    db: ctx.db,
    scopeTables: scopeTablesOf(app),
  })
  if (components === UNAUTHORIZED) return { unauthorized: true }
  const componentCtx = {
    app,
    routeParams,
    session: ctx.session,
    cookies: ctx.cookies,
    db: ctx.db,
  }

  const resolvedComponents = await Promise.all(
    components.map((item) => resolveComponent(item, componentCtx))
  )

  if (resolvedComponents.some((s) => s === UNAUTHORIZED)) return { unauthorized: true }
  if (resolvedComponents.some((s) => s === SINGLE_RECORD_NOT_FOUND)) return undefined

  return {
    ...page,
    components: resolvedComponents.filter(
      (s): s is Component | SimpleComponentReference | ComponentReference =>
        s !== SINGLE_RECORD_NOT_FOUND && s !== UNAUTHORIZED && !isDroppedWithheld(s)
    ),
  }
}
