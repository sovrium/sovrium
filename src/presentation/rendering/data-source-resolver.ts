/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasReadPermission } from '@/domain/models/app/tables/permissions'
import { resolveFilters, hasCurrentUserRef } from './current-user-resolver'
import { applyFieldLevelPermissions, getRestrictedFields } from './field-permission-filter'
import type { App } from '@/domain/models/app'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SessionInfo } from '@/domain/types/session-info'

export const SINGLE_RECORD_NOT_FOUND = Symbol('SINGLE_RECORD_NOT_FOUND')
export const UNAUTHORIZED = Symbol('UNAUTHORIZED')

export type DataSourceSectionResult =
  | Component
  | SimpleComponentReference
  | ComponentReference
  | typeof SINGLE_RECORD_NOT_FOUND
  | typeof UNAUTHORIZED

/**
 * Database access interface for data source resolution.
 *
 * Injected by the caller to keep the presentation layer free of
 * direct infrastructure/database dependencies. The live implementation
 * is provided by DataSourceRepositoryLive in the infrastructure layer.
 */
export interface DataSourceDb {
  readonly fetchRecords: (
    tableName: string,
    options?: {
      readonly fields?: readonly string[]
      readonly filter?: readonly DataFilter[]
      readonly sort?: readonly DataSort[]
      readonly pageSize?: number
      readonly page?: number
    }
  ) => Promise<readonly Record<string, unknown>[]>

  readonly countRecords: (tableName: string, filter?: readonly DataFilter[]) => Promise<number>

  readonly fetchSingleRecord: (
    tableName: string,
    paramField: string,
    paramValue: string,
    fields?: readonly string[]
  ) => Promise<Record<string, unknown> | undefined>

  /** Optional — required only for `$currentUser.assignments.<table>` filters. */
  readonly fetchUserAssignments?: (userId: string, tableSlug: string) => Promise<readonly string[]>
}

/** Injects a _dataSourceError prop into a component's props. */
export function withDataSourceError(component: Component, errorMessage: string): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _dataSourceError: errorMessage,
    },
  }
}

/** Validates dataSource fields against a table's field definitions. */
export function validateDataSourceFields(
  component: Component,
  tableName: string,
  requestedFields: readonly string[],
  tableFieldNames: Set<string>
): Component | undefined {
  const missingFields = requestedFields.filter((f) => !tableFieldNames.has(f))
  if (missingFields.length === 0) return undefined
  return withDataSourceError(
    component,
    `Error: fields not found in table "${tableName}": ${missingFields.join(', ')}`
  )
}

/** Replaces $record.fieldName placeholders with actual field values from a record. */
export function substituteRecordVars(text: string, record: Record<string, unknown>): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value !== undefined ? String(value) : ''
  })
}

/**
 * Substitutes `$record.<field>` tokens inside `dataSource.filter[].value`
 * strings using the parent collection record (US-PAGES-ACCESS-PUBLISHING-003 —
 * Category & Tag Patterns).
 *
 * The collection-page resolver runs BEFORE component-level dataSource
 * resolution, so a category page's `$record.name` token is the parent
 * category's name. By substituting it here, a nested
 * `dataSource.filter[].value: '$record.name'` becomes a concrete literal
 * (eg. `'Technology'`) before `resolvePageDataSources` builds the SQL
 * query — enabling cross-table filtering driven by the parent record.
 *
 * Only string filter values are substituted. Numeric, boolean, array, and
 * `$currentUser` reference values pass through unchanged so the existing
 * filter pipeline (literal types + `$currentUser` resolver) keeps working.
 */
function substituteRecordInDataSource(
  dataSource: NonNullable<Component['dataSource']>,
  record: Record<string, unknown>
): NonNullable<Component['dataSource']> {
  const { filter } = dataSource
  if (!filter || filter.length === 0) return dataSource
  return {
    ...dataSource,
    filter: filter.map(
      (f: DataFilter): DataFilter =>
        typeof f.value === 'string' ? { ...f, value: substituteRecordVars(f.value, record) } : f
    ),
  }
}

/**
 * Recursively substitutes $record.* variables in a component's props,
 * content, dataSource filters, AND children.
 *
 * Used by:
 *  - `applySingleRecordToComponent` (single-mode dataSource): the fetched
 *    record drives substitution at every level — children must be
 *    substituted because they consume the bound record's fields directly.
 *  - `expandDataSourceChildren` (list-mode dataSource): each per-row
 *    record substitutes the child template — same rationale.
 *
 * The collection-page resolver uses a different helper
 * (`substituteRecordInCollectionTemplate`) that intentionally skips the
 * children of components that themselves have a `dataSource`, because
 * those children are per-row templates that must be expanded against
 * each fetched record — not pre-substituted with the parent collection
 * record (US-PAGES-ACCESS-PUBLISHING-003 — Category & Tag Patterns).
 */
export function substituteRecordInComponent(
  component: Component,
  record: Record<string, unknown>
): Component {
  return {
    ...component,
    props: component.props ? substituteRecordInProps(component.props, record) : component.props,
    content:
      typeof component.content === 'string'
        ? substituteRecordVars(component.content, record)
        : component.content,
    dataSource: component.dataSource
      ? substituteRecordInDataSource(component.dataSource, record)
      : component.dataSource,
    children: component.children?.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInComponent(child, record)
    ),
  }
}

/**
 * Variant of `substituteRecordInComponent` used by the collection-page
 * resolver to substitute the parent collection record's fields into the
 * page's components (US-PAGES-ACCESS-PUBLISHING-003 — Category & Tag
 * Patterns).
 *
 * The key difference from `substituteRecordInComponent`: when a component
 * declares a `dataSource`, its `children` are LEFT UNSUBSTITUTED.
 * Reasoning: those children are per-row templates that
 * `expandDataSourceChildren` substitutes later against each fetched row.
 * Pre-substituting them with the parent category/tag record would
 * clobber the inner `$record.*` tokens (eg. `$record.title` of a post)
 * with the parent's fields (eg. `$record.title` of a category), making
 * row-level data binding impossible.
 *
 * Props, content, and `dataSource.filter[].value` ARE substituted — the
 * parent record drives cross-table filtering (eg.
 * `filter: [{ field: 'category', value: '$record.name' }]`).
 */
export function substituteRecordInCollectionTemplate(
  component: Component,
  record: Record<string, unknown>
): Component {
  const baseProps = component.props
    ? substituteRecordInProps(component.props, record)
    : component.props
  const baseContent =
    typeof component.content === 'string'
      ? substituteRecordVars(component.content, record)
      : component.content

  if (component.dataSource) {
    return {
      ...component,
      props: baseProps,
      content: baseContent,
      dataSource: substituteRecordInDataSource(component.dataSource, record),
      // Children left UNSUBSTITUTED — per-row templates expanded later.
    }
  }

  return {
    ...component,
    props: baseProps,
    content: baseContent,
    children: component.children?.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInCollectionTemplate(child, record)
    ),
  }
}

function substituteRecordInProps(
  props: Record<string, unknown>,
  record: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteRecordVars(value, record) : value,
    ])
  )
}

/** Expands a data-bound component's children once per record. */
export interface PaginationMeta {
  readonly pageSize: number
  readonly totalCount: number
  readonly style?: string
}

export function expandDataSourceChildren(
  component: Component,
  records: readonly Record<string, unknown>[],
  paginationMeta?: PaginationMeta
): Component {
  const paginationProps = paginationMeta
    ? {
        _paginationPageSize: paginationMeta.pageSize,
        _paginationTotalCount: paginationMeta.totalCount,
        _paginationStyle: paginationMeta.style,
      }
    : {}

  if (!component.children || component.children.length === 0 || records.length === 0) {
    return {
      ...component,
      props: { ...(component.props ?? {}), _dataSourceBound: true, ...paginationProps },
    }
  }

  const expandedChildren: readonly (Component | string)[] = records.map((record) => ({
    type: 'li' as Component['type'],
    children: component.children!.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInComponent(child, record)
    ),
  }))

  return {
    ...component,
    children: expandedChildren,
    props: { ...(component.props ?? {}), _dataSourceBound: true, ...paginationProps },
  }
}

function applySingleRecordToComponent(
  component: Component,
  record: Record<string, unknown>
): Component {
  const substituted = substituteRecordInComponent(component, record)
  return {
    ...substituted,
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
    return applySingleRecordToComponent(component, firstRecord)
  }
  const record = await db.fetchSingleRecord(
    tableName,
    paramName,
    paramValue,
    requestedFields ? [...requestedFields] : undefined
  )
  if (record === undefined) return SINGLE_RECORD_NOT_FOUND
  return applySingleRecordToComponent(component, record)
}

function checkFieldErrors(
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
  const { searchFields, debounceMs, limit } = component.dataSource ?? {}
  return {
    ...(component.props ?? {}),
    _searchMode: true,
    _searchRecords: JSON.stringify(records),
    _searchFields: JSON.stringify(searchFields ?? []),
    _searchDebounceMs: debounceMs ?? 0,
    _searchLimit: limit ?? 0,
    _searchChildTemplate: JSON.stringify(component.children ?? []),
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

/** Checks whether the current session has read permission for the given table. */
function canReadTable(
  matchedTable: Readonly<{
    name: string
    permissions?: Readonly<{ read?: unknown; inherit?: string; override?: { read?: unknown } }>
  }>,
  session: SessionInfo | undefined,
  hasAuth: boolean
): boolean {
  // When auth is not configured, all tables are readable
  if (!hasAuth) return true

  const userRole = session?.role ?? ''
  return hasReadPermission(matchedTable, userRole)
}

/** Returns a permission-denied data-bound component with no children or data. */
function emptyDataBoundComponent(component: Component): Component {
  return {
    ...component,
    children: undefined,
    props: { ...(component.props ?? {}), _dataSourceBound: true },
  }
}

/** Resolves a validated component by mode (list/single/search) with field-level filtering. */
function resolveByMode(ctx: {
  readonly component: Component
  readonly app: App
  readonly table: NonNullable<ReturnType<NonNullable<App['tables']>['find']>>
  readonly session: SessionInfo | undefined
  readonly routeParams: Readonly<Record<string, string>>
  readonly db: DataSourceDb
}): Promise<DataSourceSectionResult> {
  const { table: tableName, fields: requestedFields, mode, param } = ctx.component.dataSource!
  const restricted = ctx.app.auth
    ? getRestrictedFields(ctx.table.permissions, ctx.session?.role ?? '')
    : new Set<string>()
  const { component: fc, fields: ff } = applyFieldLevelPermissions(
    ctx.component,
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

/** Validates prerequisites: table existence and read permissions. */
function validateDataSourcePrereqs(
  component: Component,
  ctx: {
    readonly matchedTable: ReturnType<NonNullable<App['tables']>['find']>
    readonly tableName: string
    readonly session: SessionInfo | undefined
    readonly hasAuth: boolean
  }
): Component | undefined {
  if (!ctx.matchedTable) {
    return withDataSourceError(component, `Error: table "${ctx.tableName}" not found`)
  }
  if (!canReadTable(ctx.matchedTable, ctx.session, ctx.hasAuth)) {
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
  if ('component' in item || '$ref' in item) return item
  const component = item as Component
  if (!component.dataSource) return component

  const { table: tableName, fields: requestedFields } = component.dataSource
  const matchedTable = (app.tables ?? []).find((t) => t.name === tableName)
  const prereqResult = validateDataSourcePrereqs(component, {
    matchedTable,
    tableName,
    session,
    hasAuth: !!app.auth,
  })
  if (prereqResult) return prereqResult

  const fieldError = checkFieldErrors(component, tableName, requestedFields, matchedTable!.fields)
  if (fieldError) return fieldError

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
    scopeTables: app.auth?.scopeTables,
  })
  if (resolvedComponent === UNAUTHORIZED) return UNAUTHORIZED

  return resolveByMode({
    component: resolvedComponent,
    app,
    table: matchedTable!,
    session,
    routeParams,
    db,
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
    readonly scopeTables?: readonly string[]
  }
): Promise<Component | typeof UNAUTHORIZED> {
  const filters = component.dataSource?.filter
  if (!hasCurrentUserRef(filters)) return component

  const result = await resolveFilters(filters, {
    session: ctx.session,
    cookies: ctx.cookies,
    fetchAssignments: ctx.db.fetchUserAssignments,
    ...(ctx.scopeTables !== undefined ? { scopeTables: ctx.scopeTables } : {}),
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
