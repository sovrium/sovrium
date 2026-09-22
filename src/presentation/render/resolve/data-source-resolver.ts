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
 * resolve the `$currentUser` filters, then dispatch to the mode resolver. Each
 * stage lives in a sibling module — the shared vocabulary in
 * `data-source-contracts.ts`, `$record` substitution in `record-substitution.ts`,
 * the per-row expansion and island stamps in `data-source-rows.ts`, the mode
 * resolvers in `data-source-modes.ts` — so this file is the sequence and the
 * page-level walk, and nothing else.
 */

import { isComponentReferenceNode } from '@/presentation/render/resolve/component-reference'
import { hasCurrentUserRef, resolveFilters, scopeTablesOf } from './current-user-resolver'
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
  emptyDataBoundComponent,
  resolveByMode,
  resolveRenderPlan,
} from './data-source-modes'
import { resolveIslandShortCircuit, stampNestedIslands } from './data-source-rows'
import { bindRouteParams } from './route-param-binding'
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
  // `plan === undefined` is the auth-not-configured full-access model.
  if (ctx.plan !== undefined && !ctx.plan.allowed) {
    return emptyDataBoundComponent(component)
  }
  return undefined
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
  const { app, routeParams, session, cookies, db } = ctx
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
  if (!component.dataSource) return stampNestedIslands(component, { app, routeParams })

  // CAP-1/CAP-2: a client-fetching data-bound component (a `list` itemTemplate
  // binding, or a `record-field` self-binding to a system DETAIL endpoint) is
  // stamped for its island and SKIPS server-side resolution + app.tables
  // cross-validation — the island owns the fetch.
  const islandStamped = resolveIslandShortCircuit(component, routeParams)
  if (islandStamped) return islandStamped

  const { table: tableName, fields: requestedFields } = component.dataSource
  const matchedTable = (app.tables ?? []).find((t) => t.name === tableName)
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
  if (component.type === 'drawer') return component

  // Z-1 / P-6: Resolve `$currentUser.*` references in dataSource.filter.
  // - Unauthenticated requests on filters with $currentUser refs return 401
  //   (defense-in-depth: filter resolution is server-enforced).
  // - Unrestricted users (admin) bypass assignments-based filters entirely.
  // - `$currentUser.activeAssignment` requires `scopeTables` so the cookie
  //   value can be validated against the configured scope set
  //   (tamper-resistant — see current-user-resolver.ts).
  const resolvedComponent = await resolveCurrentUserFilters(component, {
    session,
    cookies,
    db,
    scopeTables: scopeTablesOf(app),
  })
  if (resolvedComponent === UNAUTHORIZED) return UNAUTHORIZED

  return resolveByMode({
    component: resolvedComponent,
    app,
    table: matchedTable!,
    session,
    routeParams,
    db,
    plan,
  })
}

/**
 * Resolves `$currentUser.*` references inside `dataSource.filter[].value`,
 * returning a new component with concrete literal values. Returns
 * `UNAUTHORIZED` when an unauthenticated request hits a filter that
 * contains a `$currentUser` reference.
 */
async function resolveCurrentUserFilters(
  component: Component,
  ctx: {
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>> | undefined
    readonly db: DataSourceDb
    readonly scopeTables: readonly string[]
  }
): Promise<Component | typeof UNAUTHORIZED> {
  const filters = component.dataSource?.filter
  if (!hasCurrentUserRef(filters)) return component

  const result = await resolveFilters(filters, {
    session: ctx.session,
    cookies: ctx.cookies,
    fetchAssignments: ctx.db.fetchUserAssignments,
    scopeTables: ctx.scopeTables,
  })
  if (result.kind === 'unauthorized') return UNAUTHORIZED

  // Replace the dataSource with a copy where every `$currentUser.*` value
  // is now a concrete literal (or empty array for missing assignments).
  return {
    ...component,
    dataSource: {
      ...component.dataSource!,
      filter: result.filter,
    },
  }
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
  const componentCtx = {
    app,
    routeParams,
    session: ctx.session,
    cookies: ctx.cookies,
    db: ctx.db,
  }

  const resolvedComponents = await Promise.all(
    page.components.map((item) => resolveComponent(item, componentCtx))
  )

  if (resolvedComponents.some((s) => s === UNAUTHORIZED)) return { unauthorized: true }
  if (resolvedComponents.some((s) => s === SINGLE_RECORD_NOT_FOUND)) return undefined

  return {
    ...page,
    components: resolvedComponents.filter(
      (s): s is Component | SimpleComponentReference | ComponentReference =>
        s !== SINGLE_RECORD_NOT_FOUND && s !== UNAUTHORIZED
    ),
  }
}
