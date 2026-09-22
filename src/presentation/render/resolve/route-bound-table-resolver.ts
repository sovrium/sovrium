/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { normalizeRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'

/** A resolved page, or the 404 answer for a segment naming no declared table. */
export type RouteBoundTableResolution = Page | 'not-found'

/** Ambient context one page's resolution reads. */
interface ResolutionContext {
  readonly app: App
  readonly routeParams: Readonly<Record<string, string>>
  readonly session: SessionInfo | undefined
}

/**
 * Resolve a grid bound to the table the URL names, and derive that table's
 * columns.
 *
 * ─── THE TWO BINDINGS, AND WHY THEY ARE ONE PASS ───────────────────────────
 *
 * `dataSource.table: $param.table` says WHICH table; `columnsFrom: 'table'`
 * says the columns come from whatever that turns out to be. Neither is useful
 * alone: a page that learns its table at request time cannot enumerate its own
 * columns, and an operator's tables are not knowable when the config is
 * written. Together they make ONE page definition a records explorer over every
 * table an app declares.
 *
 * ─── WHY 404 AND NOT AN EMPTY GRID ─────────────────────────────────────────
 *
 * A segment naming no declared table answers 404, because "this table does not
 * exist" and "this table is empty" must not look the same to an operator
 * staring at a grid with no rows. It is the same anti-enumeration answer the
 * rest of the page surface gives (S1): the caller learns nothing about which
 * names exist.
 *
 * ─── WHY IT RUNS BEFORE THE GENERIC `$param` PASS ──────────────────────────
 *
 * `resolvePageRouteParams` substitutes every string leaf, this binding
 * included, and once it has run a route-bound table is indistinguishable from a
 * literal one. The 404 decision needs the difference — a LITERAL unknown table
 * is refused at boot by cross-validation, a route-bound one can only be judged
 * here — so this pass reads the reference while it is still there and leaves a
 * concrete name behind. The later generic pass then finds nothing to do on it.
 *
 * ─── WHY NOT A SYSTEM SOURCE ───────────────────────────────────────────────
 *
 * Re-pointing such a grid at `/api/tables/:table/records` renders rows and
 * silently drops the entire record-CRUD feature set: inline edit, the typed
 * create modal, the `_canCreate` gate, saved views and density are all gated on
 * `!isSystemSource`. Resolving the DB binding is what keeps them.
 *
 * Two passes rather than one, because the 404 is a decision about the WHOLE
 * page: a grid deeper in the tree naming an unknown table must not be answered
 * by a half-rendered page whose earlier grids resolved fine.
 */
export function resolveRouteBoundTables(
  page: Page,
  app: App,
  routeParams: Readonly<Record<string, string>>,
  session: SessionInfo | undefined
): RouteBoundTableResolution {
  const { components } = page
  if (!components || components.length === 0) return page

  const declared = new Set((app.tables ?? []).map((table) => table.name))
  const bound = collectRouteBoundNames(components, routeParams)
  if (bound.some((name) => !declared.has(name))) return 'not-found'
  if (bound.length === 0 && !hasDerivedColumns(components)) return page

  const resolved = mapNodes(components, { app, routeParams, session })
  return { ...page, components: resolved as Page['components'] }
}

/** Every table name a ROUTE reference resolves to, anywhere in the tree. */
function collectRouteBoundNames(
  nodes: readonly unknown[],
  routeParams: Readonly<Record<string, string>>
): readonly string[] {
  return nodes.flatMap((node) => {
    if (typeof node !== 'object' || node === null) return []
    const ref = normalizeRouteParamRef(declaredTableBinding(node as Record<string, unknown>))
    const own = ref === undefined ? [] : [routeParams[ref.name] ?? '']
    const { children } = node as { readonly children?: unknown }
    return Array.isArray(children)
      ? [...own, ...collectRouteBoundNames(children, routeParams)]
      : own
  })
}

/** True when any node in the tree asks for derived columns. */
function hasDerivedColumns(nodes: readonly unknown[]): boolean {
  return nodes.some((node) => {
    if (typeof node !== 'object' || node === null) return false
    const { columnsFrom, children } = node as {
      readonly columnsFrom?: unknown
      readonly children?: unknown
    }
    if (columnsFrom === 'table') return true
    return Array.isArray(children) && hasDerivedColumns(children)
  })
}

/** The raw `dataSource.table` value of a node, if it declares one. */
function declaredTableBinding(node: Record<string, unknown>): unknown {
  const { dataSource } = node
  if (typeof dataSource !== 'object' || dataSource === null) return undefined
  return (dataSource as { readonly table?: unknown }).table
}

/** Map an array of nodes, resolving each one's bindings and recursing. */
function mapNodes(nodes: readonly unknown[], ctx: ResolutionContext): readonly unknown[] {
  return nodes.map((node) => mapNode(node, ctx))
}

/** Resolve one node's bindings, then recurse into its children. */
function mapNode(node: unknown, ctx: ResolutionContext): unknown {
  if (typeof node !== 'object' || node === null) return node
  const resolved = resolveGridBindings(node as Record<string, unknown>, ctx)

  const { children } = resolved as { readonly children?: unknown }
  if (!Array.isArray(children) || children.length === 0) return resolved
  return { ...resolved, children: mapNodes(children, ctx) }
}

/** Bind the table named by the route, then derive its columns if asked to. */
function resolveGridBindings(
  node: Record<string, unknown>,
  ctx: ResolutionContext
): Record<string, unknown> {
  const declaredTable = declaredTableBinding(node)
  if (typeof declaredTable !== 'string') return node

  const ref = normalizeRouteParamRef(declaredTable)
  const tableName = ref === undefined ? declaredTable : (ctx.routeParams[ref.name] ?? '')
  const bound =
    tableName === declaredTable
      ? node
      : { ...node, dataSource: { ...(node['dataSource'] as object), table: tableName } }

  if (bound['columnsFrom'] !== 'table') return bound

  // `columnsFrom` is consumed here and dropped: leaving it beside the `columns`
  // it just produced is the exact pair `collectPageBindingViolations` refuses.
  const { columnsFrom: _consumed, ...rest } = bound
  const columns = deriveColumns(tableName, ctx)
  return columns === undefined ? rest : { ...rest, columns }
}

/**
 * One column per declared field of the bound table, in declaration order,
 * honouring FIELD-LEVEL read permissions for the requesting session.
 *
 * The permission filter is the whole reason this is derived server-side rather
 * than left to the island's auto-generation fallback, which sees only the field
 * NAMES and no session: a field the caller may not read must yield no column,
 * exactly as an authored one would be dropped, or an explorer page becomes a
 * way around the field permissions the records API enforces.
 *
 * Returns `undefined` — no `columns` key — when the caller may not read the
 * table at all, or when every field is restricted. An empty array is a value
 * the authored schema rejects, and the grid's own empty state is the honest
 * answer either way.
 */
function deriveColumns(
  tableName: string,
  ctx: ResolutionContext
): readonly { readonly field: string }[] | undefined {
  const table = (ctx.app.tables ?? []).find((declared) => declared.name === tableName)
  if (!table) return undefined

  const readable = readableFieldNames(table, ctx)
  if (readable === undefined || readable.length === 0) return undefined
  return readable.map((field) => ({ field }))
}

/** The field names this caller may read, or `undefined` when the table is closed to them. */
function readableFieldNames(
  table: NonNullable<App['tables']>[number],
  ctx: ResolutionContext
): readonly string[] | undefined {
  const names = table.fields.map((field) => field.name)
  // No auth configured → the full-access model, matching every other read gate.
  if (!ctx.app.auth) return names

  const plan = buildReadAccessPlan({
    app: ctx.app,
    table: table as TableLike,
    principal: readPrincipalFromSession(ctx.session),
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return undefined
  return names.filter((name) => !plan.restrictedColumns.has(name))
}
