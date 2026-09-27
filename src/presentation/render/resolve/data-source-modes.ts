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
 * One module because the modes share a composition rather than a signature:
 * each reads the same access plan, applies the same field-level filter, and
 * hands its result to the same `withWritePermissionGates` stamp. `resolveByMode`
 * is the dispatch, and keeping the branches beside it is what makes the shared
 * steps visible as shared.
 */

import {
  hasCreatePermission,
  hasInlineEditDefault,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { fieldNamesMatch } from '@/domain/models/app/tables/field-name-matching'
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
  stripRestrictedColumns,
  type ReadAccessPlan,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import {
  SINGLE_RECORD_NOT_FOUND,
  validateDataSourceFields,
  withDataSourceError,
  type DataSourceDb,
  type DataSourceSectionResult,
} from './data-source-contracts'
import { expandDataSourceChildren } from './data-source-rows'
import { applyFieldLevelPermissions } from './field-permission-filter'
import { rowLevelCheckForVisitor, type RowLevelReadCheck } from './record-read-gate'
import { substituteRecordInComponent } from './record-substitution'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Synthesizes a render-time-only `favorites-button` child component.
 *
 * The `favorites-button` type is never schema-authored — it is injected here
 * so that every single-record detail page automatically gets a star toggle
 * bound to the host record. The renderer for this type lives in the component
 * registry and emits an accessible `<button>` plus an inline toggle runtime.
 */
function buildFavoritesButton(tableName: string, record: Record<string, unknown>): Component {
  const recordId = record['id']
  return {
    type: 'favorites-button' as Component['type'],
    entityType: 'record',
    entityId: recordId !== undefined && recordId !== null ? String(recordId) : '',
    tableName,
  } as unknown as Component
}

/**
 * The columns a record carries whatever a form lists: its id (the address a
 * save writes to) and its save token, under both spellings the row can have.
 */
const RECORD_IDENTITY_KEYS: ReadonlySet<string> = new Set(['id', 'updatedAt', 'updated_at'])

/**
 * The record a `form` serialises into the page, narrowed to the fields it
 * lists (all of them when it lists none) plus {@link RECORD_IDENTITY_KEYS}.
 *
 * A form prefills its inputs from `_record`, and `_record` reaches the HTML
 * whole — as the island's props — whatever the inputs show. So a column the
 * form does not list has no business in it, however readable it is. Names are
 * matched the way the form's own field resolver matches them
 * (`fieldNamesMatch`), so `firstName` in the form still finds `first_name`.
 * Every other component keeps the record it was given.
 */
function narrowRecordToComponent(component: Component, record: RecordRow): RecordRow {
  if (component.type !== 'form') return record
  const { fields } = component as { readonly fields?: readonly { readonly field?: string }[] }
  const listed = (fields ?? []).flatMap((f) => (typeof f.field === 'string' ? [f.field] : []))
  if (listed.length === 0) return record
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key]) => RECORD_IDENTITY_KEYS.has(key) || listed.some((name) => fieldNamesMatch(key, name))
    )
  )
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
  ctx: { readonly tableName: string; readonly plan: ReadAccessPlan | undefined }
): Component {
  const substituted = substituteRecordInComponent(component, { ...record }, ctx.tableName)
  const existingChildren = (substituted.children ?? []) as ReadonlyArray<Component | string>
  return {
    ...substituted,
    // Append the favorites star toggle as the last child so any record
    // detail page exposes a bookmark control without schema authoring.
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
  readonly tableName: string
  readonly param: string | undefined
  readonly requestedFields: readonly string[] | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
  readonly plan: ReadAccessPlan | undefined
  /** The table's row-level read check for this visitor; `undefined` admits every row. */
  readonly rowLevelCheck: RowLevelReadCheck | undefined
}

/**
 * The fetched row as this visitor may see it, or `undefined` when its
 * row-level rule hides it: the row less the plan's restricted columns, then
 * narrowed to the binding's `fields` when it lists any.
 *
 * The row is fetched with every column when a row-level rule exists, because
 * the rule reads a column (`manager_id`, say) the binding need not list; the
 * narrowing to `fields` happens here instead, after the rule has been asked.
 */
async function gateSingleRecord(
  record: RecordRow,
  options: SingleModeOptions
): Promise<RecordRow | undefined> {
  if (options.rowLevelCheck !== undefined && !(await options.rowLevelCheck(record))) {
    return undefined
  }
  const readable =
    options.plan === undefined ? record : stripRestrictedColumns(options.plan, record)
  const { requestedFields } = options
  if (requestedFields === undefined || options.rowLevelCheck === undefined) return readable
  return Object.fromEntries(
    Object.entries(readable).filter(([key]) => requestedFields.includes(key))
  )
}

/** The columns to SELECT: all of them when a row-level rule must read the row first. */
function selectedFields(options: SingleModeOptions): string[] | undefined {
  if (options.rowLevelCheck !== undefined) return undefined
  return options.requestedFields ? [...options.requestedFields] : undefined
}

/**
 * The record behind a single-mode binding: the route parameter's row, or —
 * when the binding names no `param` and the URL has no matching segment (a
 * static path like `/profile/edit`) — the table's first row, so a
 * single-record view works without a dynamic route param.
 */
async function fetchSingleModeRecord(
  options: SingleModeOptions
): Promise<RecordRow | undefined | { readonly missingParam: string }> {
  const { tableName, param, routeParams, db } = options
  const paramName = param ?? tableName
  const paramValue = routeParams[paramName]
  if (paramValue) {
    return db.fetchSingleRecord(tableName, paramName, paramValue, selectedFields(options))
  }
  if (param !== undefined) return { missingParam: paramName }
  const fallbackRecords = await db.fetchRecords(tableName, {
    fields: selectedFields(options),
    pageSize: 1,
    page: 1,
  })
  return fallbackRecords[0]
}

/**
 * Resolve a `mode: single` binding for this visitor.
 *
 * The record reaches the page (its `$record.*` text, a form's prefilled
 * values, the island props), so it answers the records API's gates first: a
 * row the table's row-level rule hides answers exactly as a row that does not
 * exist — the page's 404, so the page cannot be used to learn which ids exist —
 * and a readable row arrives less the columns this visitor may not read. The
 * table-read refusal is answered before this runs (`denyWhenUnreadable`).
 */
async function resolveSingleMode(
  component: Component,
  options: SingleModeOptions
): Promise<Component | typeof SINGLE_RECORD_NOT_FOUND> {
  const fetched = await fetchSingleModeRecord(options)
  if (fetched !== undefined && 'missingParam' in fetched) {
    return withDataSourceError(
      component,
      `Error: route parameter "${String(fetched.missingParam)}" not found`
    )
  }
  if (fetched === undefined) return SINGLE_RECORD_NOT_FOUND
  const record = await gateSingleRecord(fetched, options)
  if (record === undefined) return SINGLE_RECORD_NOT_FOUND
  return applySingleRecordToComponent(component, record, {
    tableName: options.tableName,
    plan: options.plan,
  })
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

function buildListQueryOptions(
  component: Component,
  requestedFields: readonly string[] | undefined
) {
  const filter = component.dataSource?.filter ?? undefined
  const sort = component.dataSource?.sort ?? undefined
  return {
    queryOpts: {
      fields: requestedFields ? [...requestedFields] : undefined,
      filter,
      sort,
      pageSize: component.dataSource?.pagination?.pageSize,
      page: 1,
    },
    filter,
    pagination: component.dataSource?.pagination,
  }
}

async function resolveListMode(
  db: DataSourceDb,
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined
): Promise<Component> {
  const { queryOpts, filter, pagination } = buildListQueryOptions(component, requestedFields)
  const pageSize = pagination?.pageSize

  const [records, totalCount] = await Promise.all([
    db.fetchRecords(tableName, queryOpts),
    pageSize !== undefined ? db.countRecords(tableName, filter) : Promise.resolve(0),
  ])

  const paginationMeta =
    pageSize !== undefined ? { pageSize, totalCount, style: pagination?.style } : undefined

  return expandDataSourceChildren(component, records, paginationMeta)
}

function buildSearchProps(
  component: Component,
  records: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const { searchFields, debounceMs, limit, bindTo } = component.dataSource ?? {}
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
    // `bindTo` defers the query to an external `search-input` component; the list
    // then renders results only (no own input box) to avoid duplicate inputs.
    ...(bindTo !== undefined ? { _searchBindTo: bindTo } : {}),
    ...(listDisplay !== undefined ? { _listDisplay: JSON.stringify(listDisplay) } : {}),
  }
}

/**
 * Resolve a `mode: search` binding: every matching row is serialised into the
 * island's props so the island can filter client-side.
 *
 * Serialised WHOLE, so each row first loses the columns this visitor may not
 * read. A binding that lists no `fields` selects every column, and without the
 * projection a restricted one reached the page inside `data-island-props`
 * although no child template ever printed it.
 */
async function resolveSearchMode(
  db: DataSourceDb,
  component: Component,
  tableName: string,
  ctx: {
    readonly requestedFields: readonly string[] | undefined
    readonly plan: ReadAccessPlan | undefined
  }
): Promise<Component> {
  const { requestedFields, plan } = ctx
  const records = await db.fetchRecords(tableName, {
    fields: requestedFields ? [...requestedFields] : undefined,
    filter: component.dataSource?.filter ?? undefined,
    sort: component.dataSource?.sort ?? undefined,
  })
  const readable =
    plan === undefined ? records : records.map((record) => stripRestrictedColumns(plan, record))
  return { ...component, props: buildSearchProps(component, readable) }
}

/**
 * The composed read plan for an SSR data-bound component.
 *
 * `undefined` means "auth is not configured" — the full-access model, under
 * which every table is readable and no column is restricted.
 *
 * ROW-LEVEL SCOPING IS NOT PART OF THIS PLAN: `rowContext` is omitted, the
 * plan reports `'unresolved'`, and no caller reads that field. The row-level
 * rule is answered where a single row is in hand instead — evaluated in memory
 * against the fetched row (`record-read-gate.ts`) by a `mode: single` binding,
 * a page-level `dataSource`, and a collection page.
 * A list binding over a row-scoped table does not apply it server-side; its
 * island reads through the records API, which does.
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
    principal: readPrincipalFromSession(ctx.session),
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
 */
function emptyDataBoundComponent(component: Component): Component {
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
 * `_canCreate` offers the toolbar "Nouvel
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
 * [internal ref]'s picker may create a missing related record inline. Whether the
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
  const role = ctx.session?.role ?? ''
  const groups = ctx.session?.groups ?? []
  return Object.fromEntries(
    ctx.table.fields.flatMap((field) => {
      if (field.type !== 'relationship') return []
      const { relatedTable } = field as { readonly relatedTable?: string }
      if (relatedTable === undefined) return []
      const related = ctx.app.tables?.find((t) => t.name === relatedTable)
      return [[field.name, hasCreatePermission(related, role, ctx.app.tables, groups)] as const]
    })
  )
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
  const groups = session.groups ?? []
  return {
    _canCreate: hasCreatePermission(ctx.table, session.role, ctx.app.tables, groups),
    _canUpdate: hasInlineEditDefault(ctx.table, session.role, ctx.app.tables, groups),
    // Per-relationship-field create gates. Stamped alongside the two
    // table-level gates because this is the one layer holding BOTH the session
    // and `app.tables` — the picker's create affordance needs the second
    // table's permissions, which no other seam can see.
    _canCreateRelated: relatedCreateGates(ctx),
  }
}

function withWritePermissionGates(ctx: WriteGateContext): Component {
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
 */
export function gateNestedTableBinding(
  component: Component,
  ctx: { readonly app: App; readonly session: SessionInfo | undefined }
): Component {
  if (component.type !== 'table') return component
  // Reads through the view's own route, gated by the view's grant.
  if (component.dataSource?.view !== undefined) return component
  const tableName = component.dataSource?.table
  const table =
    typeof tableName === 'string'
      ? (ctx.app.tables ?? []).find((t) => t.name === tableName)
      : undefined
  if (table === undefined) return component
  const plan = resolveRenderPlan({
    matchedTable: table as TableLike,
    app: ctx.app,
    session: ctx.session,
  })
  return (
    denyWhenUnreadable(component, plan) ??
    withWritePermissionGates({ component, app: ctx.app, table, session: ctx.session })
  )
}

/**
 * The row-level read check a single-mode binding answers; `undefined` when
 * auth is not configured — the full-access model — or there is nothing to check.
 */
function rowLevelCheckOf(ctx: {
  readonly app: App
  readonly table: TableLike
  readonly session: SessionInfo | undefined
  readonly db: DataSourceDb
}): RowLevelReadCheck | undefined {
  return ctx.app.auth ? rowLevelCheckForVisitor(ctx.table, ctx.session, ctx.db) : undefined
}

/** Resolves a validated component by mode (list/single/search) with field-level filtering. */
export function resolveByMode(ctx: {
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
    return Promise.resolve(gateInheritedRecord(ctx.component, ctx.plan))
  }
  const { table: tableName, fields: requestedFields, mode, param } = ctx.component.dataSource!
  // The plan's restricted set, NOT a locally re-derived one. The predecessor
  // (`getRestrictedFields`) early-returned an empty set whenever the table
  // declared no `permissions.fields` — which is exactly when the built-in
  // default rules are the only field-level control there is, so a `viewer`
  // granted table read saw every column on a page while the records API
  // stripped all but name/title from the same table.
  const restricted = ctx.plan?.restrictedColumns ?? new Set<string>()
  const gated = withWritePermissionGates(ctx)
  const { component: fc, fields: ff } = applyFieldLevelPermissions(
    gated,
    requestedFields,
    restricted
  )
  if (mode === 'single') {
    return resolveSingleMode(fc, {
      tableName,
      param,
      requestedFields: ff,
      routeParams: ctx.routeParams,
      db: ctx.db,
      plan: ctx.plan,
      rowLevelCheck: rowLevelCheckOf(ctx),
    })
  }
  if (mode === 'search')
    return resolveSearchMode(ctx.db, fc, tableName, { requestedFields: ff, plan: ctx.plan })
  return resolveListMode(ctx.db, fc, tableName, ff)
}
