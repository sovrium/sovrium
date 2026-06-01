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

  readonly fetchUserAssignments?: (userId: string, tableSlug: string) => Promise<readonly string[]>

  readonly fetchUserAccessRoles?: (userId: string) => Promise<readonly string[]>
}

export function withDataSourceError(component: Component, errorMessage: string): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _dataSourceError: errorMessage,
    },
  }
}

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

export function substituteRecordVars(text: string, record: Record<string, unknown>): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value !== undefined ? String(value) : ''
  })
}

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
  const substituted = substituteRecordInComponent(component, record)
  const existingChildren = (substituted.children ?? []) as ReadonlyArray<Component | string>
  return {
    ...substituted,
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
  const { searchFields, debounceMs, limit, bindTo } = component.dataSource ?? {}
  const { listDisplay } = component as { listDisplay?: unknown }
  return {
    ...(component.props ?? {}),
    _searchMode: true,
    _searchRecords: JSON.stringify(records),
    _searchFields: JSON.stringify(searchFields ?? []),
    _searchDebounceMs: debounceMs ?? 0,
    _searchLimit: limit ?? 0,
    _searchChildTemplate: JSON.stringify(component.children ?? []),
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
  const records = await db.fetchRecords(tableName, {
    fields: requestedFields ? [...requestedFields] : undefined,
    filter: component.dataSource?.filter ?? undefined,
    sort: component.dataSource?.sort ?? undefined,
  })

  return { ...component, props: buildSearchProps(component, records) }
}

function canReadTable(
  matchedTable: Readonly<{
    name: string
    permissions?: Readonly<{ read?: unknown; inherit?: string; override?: { read?: unknown } }>
  }>,
  session: SessionInfo | undefined,
  hasAuth: boolean
): boolean {
  if (!hasAuth) return true

  const userRole = session?.role ?? ''
  return hasReadPermission(matchedTable, userRole)
}

function emptyDataBoundComponent(component: Component): Component {
  return {
    ...component,
    children: undefined,
    props: { ...(component.props ?? {}), _dataSourceBound: true },
  }
}

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

  return {
    ...component,
    dataSource: {
      ...component.dataSource!,
      filter: result.filter,
    },
  }
}

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
