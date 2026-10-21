/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { normalizeRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import {
  callerReaderFromSession,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { tableLabelPlural } from '@/domain/models/app/tables/table-display-name-service'
import { writeOnlyFieldNames } from '@/domain/models/app/tables/write-only-field-service'
import { WRITE_ONLY_PRESENCE_LABELS } from '@/presentation/render/props/write-only-presence-labels'
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
  /** The language the PAGE is served in — the one a `$t:` label resolves to. */
  readonly lang: string
  /** The route params this page binds a table to (`table` for `$param.table`). */
  readonly tableParams?: ReadonlySet<string>
  /** A specimen's sample address: a segment naming no declared table is drawn, not refused. */
  readonly admitUndeclared?: boolean
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
  request: Omit<ResolutionContext, 'app'>
): RouteBoundTableResolution {
  const { components } = page
  if (!components || components.length === 0) return page

  const declared = new Set((app.tables ?? []).map((table) => table.name))
  const params = collectRouteBoundParams(components)
  const bound = params.map((param) => request.routeParams[param] ?? '')
  if (request.admitUndeclared !== true && bound.some((name) => !declared.has(name)))
    return 'not-found'
  if (bound.length === 0 && !hasDerivedColumns(components)) return page

  const resolved = mapNodes(components, { ...request, app, tableParams: new Set(params) })
  return { ...page, components: resolved as Page['components'] }
}

/** Every route param a table binding names (`table` for `$param.table`), anywhere in the tree. */
function collectRouteBoundParams(nodes: readonly unknown[]): readonly string[] {
  return nodes.flatMap((node) => {
    if (typeof node !== 'object' || node === null) return []
    const ref = normalizeRouteParamRef(declaredTableBinding(node as Record<string, unknown>))
    const own = ref === undefined ? [] : [ref.name]
    const { children } = node as { readonly children?: unknown }
    return Array.isArray(children) ? [...own, ...collectRouteBoundParams(children)] : own
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
  const resolved = resolveGridBindings(namedCrumb(node as Record<string, unknown>, ctx), ctx)

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
    ref === undefined
      ? node
      : {
          ...namedByLabel(node, ref.name, tableName, ctx),
          dataSource: { ...(node['dataSource'] as object), table: tableName },
        }

  if (bound['columnsFrom'] !== 'table') return bound

  // `columnsFrom` is consumed here and dropped: leaving it beside the `columns`
  // it just produced is the exact pair `collectPageBindingViolations` refuses.
  const { columnsFrom: _consumed, ...rest } = bound
  const columns = deriveColumns(tableName, ctx)
  return columns === undefined ? rest : { ...rest, columns }
}

/**
 * A route-bound grid's accessible name says the table as a PERSON reads it.
 *
 * `'aria-label': 'Records $param.table'` names the grid after the segment, and
 * the segment is the identifier (`invoice_lines`). In the accessible name — and
 * only there: an id, a testid or a URL is an address — the reference to the
 * bound segment reads the table's plural label (`labelPlural` → `label` →
 * `name`), its `$t:` key resolved in the language the PAGE is served in — the
 * one every other text on it speaks. A table with
 * no label reads its name, exactly as the generic pass would have written it.
 */
function namedByLabel(
  node: Record<string, unknown>,
  param: string,
  tableName: string,
  ctx: ResolutionContext
): Record<string, unknown> {
  const props = node['props'] as Readonly<Record<string, unknown>> | undefined
  const accessibleName = props?.['aria-label']
  const reference = `$param.${param}`
  if (typeof accessibleName !== 'string' || !accessibleName.includes(reference)) return node
  const label = pluralLabelOf(tableName, ctx)
  return { ...node, props: { ...props, 'aria-label': accessibleName.replaceAll(reference, label) } }
}

/**
 * A derived breadcrumb's current crumb names the bound table as a person reads
 * it too: in its `currentLabel`, a reference to a param this page binds a table
 * to reads that table's plural label, by the rule above. Any other reference is
 * left for the generic `$param` pass, which writes the segment as it stands.
 */
function namedCrumb(
  node: Record<string, unknown>,
  ctx: ResolutionContext
): Record<string, unknown> {
  const { currentLabel } = node
  if (node['type'] !== 'breadcrumb' || typeof currentLabel !== 'string') return node
  const named = [...(ctx.tableParams ?? [])].reduce((text, param) => {
    const tableName = ctx.routeParams[param]
    const reference = `$param.${param}`
    return tableName === undefined || !text.includes(reference)
      ? text
      : text.replaceAll(reference, pluralLabelOf(tableName, ctx))
  }, currentLabel)
  return named === currentLabel ? node : { ...node, currentLabel: named }
}

/** The bound table's plural label in the page language; its name when it declares none. */
function pluralLabelOf(tableName: string, ctx: ResolutionContext): string {
  const table = (ctx.app.tables ?? []).find((declared) => declared.name === tableName)
  return table === undefined
    ? tableName
    : tableLabelPlural(table, (text) =>
        resolveTranslationPattern(text, ctx.lang, ctx.app.languages)
      )
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
 * Every derived column is `editable: false`: a records explorer is READ in the
 * grid and edited in the record drawer a row opens, so no cell turns into an
 * input and no typed row trails the grid. The header is left to the grid,
 * which prints the field's `label`, else its name made readable.
 *
 * Returns `undefined` — no `columns` key — when the caller may not read the
 * table at all, or when every field is restricted. An empty array is a value
 * the authored schema rejects, and the grid's own empty state is the honest
 * answer either way.
 */
function deriveColumns(
  tableName: string,
  ctx: ResolutionContext
): readonly Readonly<Record<string, unknown>>[] | undefined {
  const table = (ctx.app.tables ?? []).find((declared) => declared.name === tableName)
  if (!table) return undefined

  const fields = columnFields(table, ctx)
  if (fields === undefined || fields.names.length === 0) return undefined
  return fields.names.map((field) =>
    fields.presence.has(field) ? presenceColumn(field) : { field, editable: false }
  )
}

/**
 * A write-only field's column: it shows whether a value is set — the cell the
 * grid fills from the record's `_writeOnly` block — and offers no edit, sort
 * or filter, since the value is no one's to read.
 */
const presenceColumn = (field: string): Readonly<Record<string, unknown>> => ({
  field,
  editable: false,
  sortable: false,
  filterable: false,
  valueLabels: { true: WRITE_ONLY_PRESENCE_LABELS.set, false: WRITE_ONLY_PRESENCE_LABELS.unset },
})

/**
 * The fields this caller gets a column for, in declaration order — those she
 * may read, and the write-only ones she is told the presence of (`presence`) —
 * or `undefined` when the table is closed to her.
 */
function columnFields(
  table: NonNullable<App['tables']>[number],
  ctx: ResolutionContext
): { readonly names: readonly string[]; readonly presence: ReadonlySet<string> } | undefined {
  const names = table.fields.map((field) => field.name)
  // No auth configured → the full-access model, matching every other read gate.
  if (!ctx.app.auth) {
    return { names, presence: new Set(writeOnlyFieldNames(ctx.app, table.name)) }
  }

  const plan = buildReadAccessPlan({
    app: ctx.app,
    table: table as TableLike,
    principal: tableReadPrincipal(table, callerReaderFromSession(ctx.session, ctx.app)),
    policy: CANONICAL_READ_POLICY,
  })
  if (!plan.allowed) return undefined
  const shown = (name: string) =>
    !plan.restrictedColumns.has(name) || plan.presenceColumns.has(name)
  return { names: names.filter(shown), presence: plan.presenceColumns }
}
