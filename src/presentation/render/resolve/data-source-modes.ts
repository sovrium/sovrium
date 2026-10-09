/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The four `dataSource.mode` resolvers — single, list, search, and the island
 * short-circuit's props — plus the write-permission gates stamped onto whatever
 * they produce.
 *
 * One module because the modes share a composition: the same access plan, field
 * filter and `withWritePermissionGates` stamp; `resolveByMode` is the dispatch.
 */

import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import {
  hasCreatePermissionForRoles,
  hasInlineEditDefaultForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import {
  callerReaderFromSession,
  tableReadPrincipal,
} from '@/domain/models/app/tables/caller-record-gate-service'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  stripRestrictedColumns,
  type ReadAccessPlan,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { pageRecordOf } from '@/presentation/render/props/record-value-format'
import { withCallerTableView } from './caller-table-stamp'
import {
  SINGLE_RECORD_NOT_FOUND,
  validateDataSourceFields,
  withDataSourceError,
  type DataSourceDb,
  type DataSourceSectionResult,
} from './data-source-contracts'
import { expandDataSourceChildren } from './data-source-rows'
import { applyFieldLevelPermissions } from './field-permission-filter'
import {
  formManyToManyFields,
  narrowRecordToComponent,
  withManyToManyLinks,
} from './form-bound-record'
import { readRecordForCaller, readRowsForCaller, type CallerRowsQuery } from './record-read-gate'
import { substituteRecordInComponent } from './record-substitution'
import { addressRowAttachments } from './row-attachment-addresses'
import {
  isReadWithheld,
  isWithheldOverUnreadableTable,
  withheldComponent,
} from './withheld-component'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * A render-time-only `favorites-button` child: never schema-authored, injected
 * so every single-record detail page gets a star toggle bound to its record.
 */
function buildFavoritesButton(tableName: string, record: Record<string, unknown>): Component {
  const recordId = record['id']
  return {
    type: 'favorites-button' as Component['type'],
    entityType: 'record',
    entityId: recordId !== undefined && recordId !== null ? String(recordId) : '',
    tableName,
  } as Component
}

/**
 * The columns a `form` must not render an input for: every declared field this
 * visitor may not read, from the composed plan.
 *
 * Leaving the record out of the form is not enough on its own. An input with
 * no value still renders, and the form submits every input it renders — an
 * empty one included — so a field the visitor could not read would be saved
 * as blank over its real value. The records API cannot be relied on to refuse
 * that write: a field that restricts only `read` inherits its write from the
 * table's `update`. So a form carries only the inputs its visitor may read,
 * and saving it leaves every other column exactly as it was.
 */
function withheldFieldsProps(
  component: Component,
  plan: ReadAccessPlan | undefined
): Record<string, unknown> {
  if (component.type !== 'form' || plan === undefined || plan.restrictedColumns.size === 0)
    return {}
  return { _unreadableFields: [...plan.restrictedColumns] }
}

function applySingleRecordToComponent(
  component: Component,
  record: RecordRow,
  ctx: Pick<SingleModeOptions, 'tableName' | 'plan' | 'db'>
): Component {
  const pageRecord = pageRecordOf(record, ctx.tableName, ctx.db.recordText)
  const substituted = substituteRecordInComponent(component, pageRecord, ctx.tableName)
  const existingChildren = (substituted.children ?? []) as ReadonlyArray<Component | string>
  return {
    ...substituted,
    children: [...existingChildren, buildFavoritesButton(ctx.tableName, { ...record })],
    props: {
      ...(substituted.props ?? {}),
      ...withheldFieldsProps(component, ctx.plan),
      _dataSourceBound: true,
      _record: narrowRecordToComponent(component, record),
    },
  }
}

type RecordRow = Readonly<Record<string, unknown>>

interface SingleModeOptions {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly tableName: string
  readonly param: string | undefined
  readonly requestedFields: readonly string[] | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
  readonly plan: ReadAccessPlan | undefined
  /** The many-to-many fields a form shows, whose links live in junction tables. */
  readonly manyToManyFields: ReturnType<typeof formManyToManyFields>
}

/**
 * Resolve a `mode: single` binding for this visitor.
 *
 * The record reaches the page (its `$record.*` text, a form's prefilled
 * values, the island props), so it is read through the records gate
 * ({@link readRecordForCaller}): the route parameter's row, or — with no
 * `param` and no matching URL segment (`/profile/edit`) — the first row the
 * visitor may read. A row the table's row-level rule hides, or one in the
 * trash, answers exactly as a row that does not exist — the page's 404, so the
 * page cannot be used to learn which ids exist — and a readable row arrives
 * less the columns this visitor may not read. The table-read refusal is
 * answered before this runs (`denyWhenUnreadable`).
 */
async function resolveSingleMode(
  component: Component,
  options: SingleModeOptions
): Promise<Component | typeof SINGLE_RECORD_NOT_FOUND> {
  const { tableName, param, routeParams } = options
  const paramName = param ?? tableName
  const paramValue = routeParams[paramName]
  if (!paramValue && param !== undefined) {
    return withDataSourceError(component, `Error: route parameter "${paramName}" not found`)
  }
  const gatedRecord = await readRecordForCaller({
    ...options,
    at: paramValue ? { field: paramName, value: paramValue } : 'first-readable',
    fields: options.requestedFields,
  })
  if (gatedRecord === undefined) return SINGLE_RECORD_NOT_FOUND
  const record = await withManyToManyLinks(gatedRecord, options)
  return applySingleRecordToComponent(component, record, { ...options, tableName })
}

export function checkFieldErrors(
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined,
  tableFields: readonly { readonly name: string }[]
): Component | undefined {
  if (!requestedFields || requestedFields.length === 0) return undefined
  const tableFieldNames = new Set(tableFields.map((f) => f.name))
  return validateDataSourceFields(component, tableName, requestedFields, tableFieldNames)
}

/** Rows a server-drawn section reads: `limit`, its page size, or the smaller of both. */
function rowCap(dataSource: Component['dataSource']): number | undefined {
  const { limit, pagination } = dataSource ?? {}
  return limit === undefined ? pagination?.pageSize : Math.min(limit, pagination?.pageSize ?? limit)
}

/** Who a server-side read of rows answers, and through which reader. */
interface CallerReadContext {
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}

/** A binding's own `fields`, `filter` and `sort`, as one query of rows. */
function bindingQuery(
  dataSource: Component['dataSource'],
  requestedFields: readonly string[] | undefined
): CallerRowsQuery {
  return {
    ...(requestedFields !== undefined ? { fields: requestedFields } : {}),
    ...(dataSource?.filter !== undefined ? { filter: dataSource.filter } : {}),
    ...(dataSource?.sort !== undefined ? { sort: dataSource.sort } : {}),
  }
}

/**
 * Resolve a list binding: its rows are drawn on the server, so they are read
 * through the records gate ({@link readRowsForCaller}) — the rows the row-level
 * rule shows this visitor, less the columns she may not read — and the pager's
 * total counts those rows alone. Only those rows' attachments get an address.
 */
async function resolveListMode(
  component: Component,
  tableName: string,
  ctx: CallerReadContext & { readonly requestedFields: readonly string[] | undefined }
): Promise<Component> {
  const { dataSource } = component
  const pagination = dataSource?.pagination
  const pageSize = pagination?.pageSize
  const { rows, total: totalCount } = await readRowsForCaller({
    app: ctx.app,
    tableName,
    session: ctx.session,
    db: ctx.db,
    query: { ...bindingQuery(dataSource, ctx.requestedFields), pageSize: rowCap(dataSource) },
    withTotal: pageSize !== undefined,
  })

  // `limit` caps the whole section, so the pager never offers a page it may not draw.
  const total = Math.min(totalCount, dataSource?.limit ?? totalCount)
  const paginationMeta =
    pageSize !== undefined ? { pageSize, totalCount: total, style: pagination?.style } : undefined
  const sign = ctx.db.signFileUrl
  const addressed = await addressRowAttachments({ component, rows, app: ctx.app, tableName, sign })
  const pageRows = addressed.rows.map((row) => pageRecordOf(row, tableName, ctx.db.recordText))
  return expandDataSourceChildren(addressed.component, pageRows, paginationMeta)
}

function buildSearchProps(
  component: Component,
  records: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const { table, searchFields, debounceMs, limit, bindTo } = component.dataSource ?? {}
  // `listDisplay` is the declarative search-first display config (itemTemplate,
  // emptyMessage, loadMore, highlight). Only `list` components carry it.
  const { listDisplay } = component as { listDisplay?: unknown }
  return {
    ...(component.props ?? {}),
    _searchMode: true,
    _searchRecords: JSON.stringify(records),
    _searchFields: JSON.stringify(searchFields ?? []),
    _searchDebounceMs: debounceMs ?? 0,
    _searchLimit: limit ?? 0,
    _searchChildTemplate: JSON.stringify(component.children ?? []),
    // The table the rows come from, carried into the island props so the page's
    // one payload filter judges the search fields and the item template against
    // THIS table's hidden fields — not only against names hidden on every table,
    // which a readable field of the same name on another table would mask.
    ...(typeof table === 'string' ? { _searchTable: table } : {}),
    // `bindTo` defers the query to an external `search-input` component; the list
    // then renders results only (no own input box) to avoid duplicate inputs.
    ...(bindTo !== undefined ? { _searchBindTo: bindTo } : {}),
    // Kept an OBJECT, not a JSON string: the props pass that resolves `$t:`
    // walks nested objects but reads a string whole, so a serialised
    // `emptyMessage: '$t:…'` reached the page as the raw key.
    ...(listDisplay !== undefined ? { _listDisplay: listDisplay } : {}),
  }
}

/**
 * Resolve a `mode: search` binding: every matching row goes into the island's
 * props, with the formatted text it prints. Serialised WHOLE, so the rows are
 * read through the records gate ({@link readRowsForCaller}): only the rows the
 * row-level rule shows this visitor, each less the columns she may not read.
 * Every row in the payload is in the HTML whatever the island draws.
 */
async function resolveSearchMode(
  component: Component,
  tableName: string,
  ctx: CallerReadContext & { readonly requestedFields: readonly string[] | undefined }
): Promise<Component> {
  const { dataSource } = component
  const { rows } = await readRowsForCaller({
    app: ctx.app,
    tableName,
    session: ctx.session,
    db: ctx.db,
    query: bindingQuery(dataSource, ctx.requestedFields),
  })
  const pageRows = rows.map((row) => pageRecordOf(row, tableName, ctx.db.recordText))
  return { ...component, props: buildSearchProps(component, pageRows) }
}

/**
 * The composed read plan for an SSR data-bound component.
 *
 * `undefined` means "auth is not configured" — the full-access model, under
 * which every table is readable and no column is restricted.
 *
 * ROW-LEVEL SCOPING IS NOT PART OF THIS PLAN: `rowContext` is omitted, the
 * plan reports `'unresolved'`, and no caller reads that field. The row-level
 * rule is answered in memory against the fetched rows (`record-read-gate.ts`):
 * by `readRowsForCaller` for every server-drawn list, search, option list and
 * sidebar, and by the single-row checks of a `mode: single` binding, a
 * page-level `dataSource` and a collection page. A
 * grid's island reads through the records API, which applies it in SQL.
 */
export function resolveRenderPlan(ctx: {
  readonly matchedTable: TableLike | undefined
  readonly app: App
  readonly session: SessionInfo | undefined
}): ReadAccessPlan | undefined {
  if (!ctx.app.auth) return undefined
  return buildReadAccessPlan({
    app: ctx.app,
    table: ctx.matchedTable,
    principal: tableReadPrincipal(ctx.matchedTable, callerReaderFromSession(ctx.session, ctx.app)),
    policy: CANONICAL_READ_POLICY,
  })
}

/**
 * Returns a permission-denied data-bound component with no children or data.
 *
 * A `table` is reduced further, to its unbound (static) shape with no headers
 * and no rows. Dropping the children is enough for a binding whose rows the
 * server expands, but a grid's rows arrive through its island, and the island
 * props are built from the binding itself: the table name, the author's columns
 * and the field catalogue read out of `app.tables`. A grid the caller may not
 * read therefore mounted anyway, printed the column names of a table the
 * records API refuses them, and offered its toolbar. Without a `dataSource` the
 * renderer takes the static branch, which emits none of that.
 *
 * A board, a calendar, a gallery, a chart, a timeline, a drawer and a KPI are
 * withheld instead (`withheld-component.ts`): their islands are built from the
 * table's declaration, so they leave the page — a KPI keeping its label.
 */
function emptyDataBoundComponent(component: Component): Component {
  if (isWithheldOverUnreadableTable(component)) return withheldComponent(component)
  // A record the page handed down (`_record`) leaves with the binding: a form
  // the caller may not read renders empty, not prefilled from the page.
  const { _record: _withheld, ...ownProps } = (component.props ?? {}) as Record<string, unknown>
  const props = { ...ownProps, _dataSourceBound: true }
  if (component.type === 'table') {
    return { type: component.type, ...(component.id && { id: component.id }), props } as Component
  }
  return { ...component, children: undefined, props }
}

/**
 * The read-plan gate every data-bound component answers, wherever it sits:
 * the denied shape when the composed plan refuses the caller, `undefined`
 * otherwise. `plan === undefined` is the auth-not-configured full-access model.
 */
export function denyWhenUnreadable(
  component: Component,
  plan: ReadAccessPlan | undefined
): Component | undefined {
  if (plan === undefined || plan.allowed) return undefined
  return emptyDataBoundComponent(component)
}

/**
 * True when a `form` holds a record its PAGE handed down rather than one it
 * resolved itself: it carries `_record` and declares no `mode`. That is the
 * shape `inheritsPageRecord` (`page-collection-resolver.ts`) produces.
 */
export function holdsInheritedRecord(component: Component): boolean {
  if (component.type !== 'form') return false
  const binding = component.dataSource as { readonly mode?: string } | undefined
  if (binding === undefined || binding.mode !== undefined) return false
  return (component.props as { readonly _record?: unknown } | undefined)?._record !== undefined
}

/**
 * The caller's read plan, applied to a record a form inherited from its page.
 *
 * The page resolved that record whole, before any per-caller plan existed —
 * the page binding holds no session — and a form serialises its `_record` into
 * its island props whole. So without this pass a prefilled form printed columns
 * the records API withholds from the same caller. A caller the plan refuses
 * gets the form with no record at all; any other gets the record less the
 * plan's restricted columns, through the records API's own projection
 * ({@link stripRestrictedColumns}). `plan === undefined` is the
 * auth-not-configured full-access model and changes nothing.
 */
export function gateInheritedRecord(
  component: Component,
  plan: ReadAccessPlan | undefined
): Component {
  if (plan === undefined) return component
  const denied = denyWhenUnreadable(component, plan)
  if (denied !== undefined) return denied
  const props = (component.props ?? {}) as Record<string, unknown>
  const record = props['_record'] as Readonly<Record<string, unknown>>
  return {
    ...component,
    props: {
      ...props,
      ...withheldFieldsProps(component, plan),
      _record: stripRestrictedColumns(plan, record),
    },
  }
}

/**
 * {@link gateInheritedRecord} for a form nested inside a layout container,
 * where the plan is not yet built: the one nested pass holding the session
 * resolves it from the form's own table. A form naming no declared table keeps
 * nothing it was handed.
 */
export function gateNestedInheritedRecord(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  const tableName = component.dataSource?.table
  const table = (ctx.app.tables ?? []).find((t) => t.name === tableName)
  const plan = resolveRenderPlan({
    matchedTable: table as TableLike | undefined,
    app: ctx.app,
    session: ctx.session,
  })
  return gateInheritedRecord(component, plan)
}

/**
 * Stamp the render-time write-permission gates into a table component's
 * props, where the session role is known and the island's is not.
 *
 * `_canCreate` (a pages datatable spec) offers the toolbar "Nouvel
 * enregistrement" affordance only when the current role may create — absent,
 * not disabled, otherwise: anti-enumeration.
 *
 * `_canUpdate` is the permission-derived default
 * behind a column's `editable`, the one its schema annotation has always
 * promised ("default: from table permissions") and never delivered. It is
 * computed from {@link hasInlineEditDefault} rather than re-derived in the
 * browser for two reasons: the island never receives the session role, so it
 * could not answer `update: ['engineer']` at all; and a second permission
 * model in the client bundle is exactly what the `Permission Evaluator Drift`
 * gate exists to prevent.
 *
 * Both are a no-op for non-data-tables and when auth is not configured. The two
 * absent-value defaults differ, deliberately: create is OFFERED when unknown
 * (full-access model), edit is WITHHELD when unknown (fail-closed, and the
 * behaviour every grid has today).
 *
 * Both carry the caller's GROUPS as well as their role. A grant naming a group
 * (`create: ['group:ops']`) is matched against memberships and never against
 * the role string, so passing the role alone left every group-granted member
 * silently un-offered a button they were entitled to press — while the CRUD
 * form gate in this same layer (`render-page.tsx` → `gateCaller`) already
 * forwarded them. One page, two treatments.
 */
/**
 * The per-field answer to "may this caller create in the table this
 * `relationship` column points at?", keyed by field name.
 *
 * the relationship-field `allowCreate`/`maxLinked` design's picker may create a missing related record inline. Whether the
 * affordance is DRAWN follows the same anti-enumeration rule the toolbar's own
 * create button already follows: absent, never disabled — a disabled control
 * still tells the caller the related table exists and what it would accept.
 *
 * It is the SAME `hasCreatePermission` the bound table is gated by, called a
 * second time against `relatedTable`. A second permission model in the client
 * bundle is exactly what the `Permission Evaluator Drift` gate exists to
 * prevent, and the island never receives the session role, so it could not
 * answer `create: ['admin']` at all.
 */
function relatedCreateGates(ctx: {
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
}): Record<string, boolean> {
  const roles = writeGateRoles(ctx.session)
  return Object.fromEntries(
    ctx.table.fields.flatMap((field) => {
      if (field.type !== 'relationship') return []
      const { relatedTable } = field as { readonly relatedTable?: string }
      if (relatedTable === undefined) return []
      const related = ctx.app.tables?.find((t) => t.name === relatedTable)
      return [[field.name, hasCreatePermissionForRoles(related, roles, ctx.app)] as const]
    })
  )
}

/**
 * The caller's account role first, then a `group:<name>` entry per membership —
 * the shape the records API's `*ForRoles` write evaluators read, so an
 * affordance follows their rules exactly: a viewer is offered no write a group
 * grant would give her, because the API refuses it.
 */
function writeGateRoles(session: SessionInfo | undefined): readonly string[] {
  return [session?.role ?? '', ...(session?.groups ?? []).map(toGroupReference)]
}

type WriteGateContext = {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
}

/**
 * The three gates for a caller WITH a session. A visitor without one gets none
 * of them: the records API answers an anonymous create or update with 401
 * whatever the grant says, and the gates mirror what the API accepts from THIS
 * caller.
 */
function signedInWriteGates(ctx: WriteGateContext, session: SessionInfo) {
  const roles = writeGateRoles(session)
  return {
    _canCreate: hasCreatePermissionForRoles(ctx.table, roles, ctx.app),
    _canUpdate: hasInlineEditDefaultForRoles(ctx.table, roles, ctx.app),
    // Per-relationship-field create gates. Stamped alongside the two
    // table-level gates because this is the one layer holding BOTH the session
    // and `app.tables` — the picker's create affordance needs the second
    // table's permissions, which no other seam can see.
    _canCreateRelated: relatedCreateGates(ctx),
  }
}

export function withWritePermissionGates(ctx: WriteGateContext): Component {
  if (ctx.component.type !== 'table' || !ctx.app.auth) return ctx.component
  const gates =
    ctx.session !== undefined
      ? signedInWriteGates(ctx, ctx.session)
      : {
          _canCreate: false,
          _canUpdate: false,
          _canCreateRelated: Object.fromEntries(
            Object.keys(relatedCreateGates(ctx)).map((name) => [name, false])
          ),
        }
  return { ...ctx.component, props: { ...(ctx.component.props ?? {}), ...gates } }
}

/**
 * The declared table a component reads directly, or `undefined` for one that
 * reads through a view (gated by the view's own grant on its own route) or
 * names no declared table (a system source).
 */
function directlyBoundTable(component: Component, app: App) {
  if (component.dataSource?.view !== undefined) return undefined
  const tableName = component.dataSource?.table
  return typeof tableName === 'string'
    ? (app.tables ?? []).find((t) => t.name === tableName)
    : undefined
}

/**
 * The read and write gates for a table grid NESTED inside a layout container.
 *
 * `resolveComponent` gates a grid at the top level of a page, but a grid one
 * container down never reaches it: the page walk only stamps nested bindings
 * for their islands (`stampNestedIslands`), and the island reads a missing
 * `canCreate` as permission. So a blog's home page, whose posts grid sits
 * inside a section, offered `+ New record`, Import and the add-row line to
 * every visitor — and a grid over a table the caller may not read mounted and
 * printed its columns. This applies the same two gates, from the same
 * functions, wherever the grid sits: the read plan first
 * ({@link denyWhenUnreadable}), then the write stamp.
 *
 * Only the GATES are shared, not the rest of `resolveByMode`: a grid's island
 * fetches its own rows through the records API, which enforces read and field
 * permissions itself, so the server-side list query and the child-template
 * filter have nothing to do for it. A binding naming no declared table (a
 * system source) comes back untouched.
 *
 * The read gate applies, alone, to the other record components whose island is
 * built from the table's declaration (`withheld-component.ts`): one container
 * down, a board or a calendar over a table the caller may not read is withheld
 * exactly as it is at the top of the page.
 */
export function gateNestedTableBinding(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  const isGrid = component.type === 'table'
  if (!isGrid && !isWithheldOverUnreadableTable(component)) return component
  const table = directlyBoundTable(component, ctx.app)
  if (table === undefined) return gateViewBoundGrid(component, ctx)
  const plan = resolveRenderPlan({
    matchedTable: table as TableLike,
    app: ctx.app,
    session: ctx.session,
  })
  const denied = denyWhenUnreadable(component, plan)
  if (denied !== undefined || !isGrid) return denied ?? component
  return withWritePermissionGates({ component, app: ctx.app, table, session: ctx.session })
}

/**
 * A grid reading through a view: its read is the view's own grant, checked on
 * the view's route, but its writes go to the table's records — so it carries
 * the table's write gates exactly as a table-bound grid does.
 */
function gateViewBoundGrid(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  const tableName = component.dataSource?.table
  const table =
    component.type === 'table' && component.dataSource?.view !== undefined
      ? (ctx.app.tables ?? []).find((t) => t.name === tableName)
      : undefined
  return table === undefined
    ? component
    : withWritePermissionGates({ component, app: ctx.app, table, session: ctx.session })
}

/** Resolves a validated component by mode (list/single/search) with field-level filtering. */
export async function resolveByMode(ctx: {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
  readonly plan: ReadAccessPlan | undefined
}): Promise<DataSourceSectionResult> {
  // A form holding the record its page handed down has nothing left to fetch:
  // it is not a list, and resolving it as one queried the whole table only to
  // discard every row. Its record answers the caller's read plan instead.
  if (holdsInheritedRecord(ctx.component)) {
    return gateInheritedRecord(ctx.component, ctx.plan)
  }
  const { table: tableName, fields: requestedFields, mode, param } = ctx.component.dataSource!
  // The plan's restricted set, NOT a locally re-derived one. The predecessor
  // (`getRestrictedFields`) early-returned an empty set whenever the table
  // declared no `permissions.fields` — which is exactly when the built-in
  // default rules are the only field-level control there is, so a `viewer`
  // granted table read saw every column on a page while the records API
  // stripped all but name/title from the same table.
  const restricted = ctx.plan?.restrictedColumns ?? new Set<string>()
  const gated = await withCallerTableView(withWritePermissionGates(ctx), ctx)
  if (isReadWithheld(gated)) return gated
  const { component: fc, fields: ff } = applyFieldLevelPermissions(
    gated,
    requestedFields,
    restricted
  )
  if (mode === 'single') {
    return resolveSingleMode(fc, {
      app: ctx.app,
      session: ctx.session,
      tableName,
      param,
      requestedFields: ff,
      routeParams: ctx.routeParams,
      db: ctx.db,
      plan: ctx.plan,
      manyToManyFields: formManyToManyFields(fc, ctx.table, ctx.plan),
    })
  }
  const reader = { app: ctx.app, session: ctx.session, db: ctx.db, requestedFields: ff }
  if (mode === 'search') return resolveSearchMode(fc, tableName, reader)
  return resolveListMode(fc, tableName, reader)
}
