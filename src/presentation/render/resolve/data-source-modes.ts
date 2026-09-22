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
import {
  buildReadAccessPlan,
  CANONICAL_READ_POLICY,
  readPrincipalFromSession,
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

function applySingleRecordToComponent(
  component: Component,
  record: Record<string, unknown>,
  tableName: string
): Component {
  const substituted = substituteRecordInComponent(component, record, tableName)
  const existingChildren = (substituted.children ?? []) as ReadonlyArray<Component | string>
  return {
    ...substituted,
    // Append the favorites star toggle as the last child so any record
    // detail page exposes a bookmark control without schema authoring.
    children: [...existingChildren, buildFavoritesButton(tableName, record)],
    props: { ...(substituted.props ?? {}), _dataSourceBound: true, _record: record },
  }
}

interface SingleModeOptions {
  readonly tableName: string
  readonly param: string | undefined
  readonly requestedFields: readonly string[] | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
}

async function resolveSingleMode(
  component: Component,
  options: SingleModeOptions
): Promise<Component | typeof SINGLE_RECORD_NOT_FOUND> {
  const { tableName, param, requestedFields, routeParams, db } = options
  const paramName = param ?? tableName
  const paramValue = routeParams[paramName]
  if (!paramValue) {
    // If param was explicitly configured but missing from route → error.
    // If param was not specified (defaults to tableName) and the URL has no
    // matching segment (e.g. a static path like /profile/edit), fall back to
    // fetching the first record so that single-record views work without a
    // dynamic route param.
    if (param !== undefined) {
      return withDataSourceError(component, `Error: route parameter "${paramName}" not found`)
    }
    const fallbackRecords = await db.fetchRecords(tableName, {
      fields: requestedFields ? [...requestedFields] : undefined,
      pageSize: 1,
      page: 1,
    })
    const firstRecord = fallbackRecords[0]
    if (firstRecord === undefined) return SINGLE_RECORD_NOT_FOUND
    return applySingleRecordToComponent(component, firstRecord, tableName)
  }
  const record = await db.fetchSingleRecord(
    tableName,
    paramName,
    paramValue,
    requestedFields ? [...requestedFields] : undefined
  )
  if (record === undefined) return SINGLE_RECORD_NOT_FOUND
  return applySingleRecordToComponent(component, record, tableName)
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

async function resolveSearchMode(
  db: DataSourceDb,
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined
): Promise<Component> {
  // Fetch all records server-side so the island can filter client-side
  const records = await db.fetchRecords(tableName, {
    fields: requestedFields ? [...requestedFields] : undefined,
    filter: component.dataSource?.filter ?? undefined,
    sort: component.dataSource?.sort ?? undefined,
  })

  return { ...component, props: buildSearchProps(component, records) }
}

/**
 * The composed read plan for an SSR data-bound component.
 *
 * `undefined` means "auth is not configured" — the full-access model, under
 * which every table is readable and no column is restricted.
 *
 * ROW-LEVEL SCOPING IS NOT PART OF THIS PLAN, and its absence is deliberate
 * rather than forgotten: resolving `rowLevelPermissions.read.when` needs a
 * per-request database round-trip to load assignment scopes, which page render
 * has no seam for today. `rowContext` is therefore omitted, the plan reports
 * `'unresolved'`, and this caller does NOT consult it — which preserves the
 * pre-existing behaviour rather than blanking every row-level-scoped page. The
 * gap is real and tracked; see the report accompanying this change. Collection
 * pages have their own row-level gate (`page-collection-resolver.ts`,
 * [internal ref]) and are unaffected.
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

/** Returns a permission-denied data-bound component with no children or data. */
export function emptyDataBoundComponent(component: Component): Component {
  return {
    ...component,
    children: undefined,
    props: { ...(component.props ?? {}), _dataSourceBound: true },
  }
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

function withWritePermissionGates(ctx: {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
}): Component {
  if (ctx.component.type !== 'table' || !ctx.app.auth) return ctx.component
  const role = ctx.session?.role ?? ''
  const groups = ctx.session?.groups ?? []
  const _canCreate = hasCreatePermission(ctx.table, role, ctx.app.tables, groups)
  const _canUpdate = hasInlineEditDefault(ctx.table, role, ctx.app.tables, groups)
  // Per-relationship-field create gates. Stamped alongside the two
  // table-level gates because this is the one layer holding BOTH the session and
  // `app.tables` — the picker's create affordance needs the second table's
  // permissions, which no other seam can see.
  const _canCreateRelated = relatedCreateGates(ctx)
  return {
    ...ctx.component,
    props: { ...(ctx.component.props ?? {}), _canCreate, _canUpdate, _canCreateRelated },
  }
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
    })
  }
  if (mode === 'search') return resolveSearchMode(ctx.db, fc, tableName, ff)
  return resolveListMode(ctx.db, fc, tableName, ff)
}
