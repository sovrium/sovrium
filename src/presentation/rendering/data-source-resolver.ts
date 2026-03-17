/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { sanitizeTableName } from '@/infrastructure/database/field-utils'
import { formatLikePattern, formatSqlValue } from '@/infrastructure/database/sql/sql-utils'
import type { App } from '@/domain/models/app'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/component/common/component-reference'
import type { DataFilter, DataSort } from '@/domain/models/app/page/common/data-source'
import type { Component } from '@/domain/models/app/page/sections'
import type { Page } from '@/domain/models/app/pages'

// ─── Sentinel ────────────────────────────────────────────────────────────────

/** Sentinel returned when a single-mode dataSource finds no matching record */
export const SINGLE_RECORD_NOT_FOUND = Symbol('SINGLE_RECORD_NOT_FOUND')

export type DataSourceSectionResult =
  | Component
  | SimpleComponentReference
  | ComponentReference
  | typeof SINGLE_RECORD_NOT_FOUND

// ─── Error injection ─────────────────────────────────────────────────────────

/**
 * Injects a _dataSourceError prop into a component's props
 */
export function withDataSourceError(component: Component, errorMessage: string): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _dataSourceError: errorMessage,
    },
  }
}

// ─── Field validation ─────────────────────────────────────────────────────────

/**
 * Validates dataSource fields against a table's field definitions
 */
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

// ─── $record.* substitution helpers ─────────────────────────────────────────

/**
 * Replaces $record.fieldName placeholders with actual field values from a record
 */
export function substituteRecordVars(text: string, record: Record<string, unknown>): string {
  return text.replace(/\$record\.([a-zA-Z0-9_]+)/g, (_, fieldName: string) => {
    const value = record[fieldName]
    return value !== undefined ? String(value) : ''
  })
}

/**
 * Recursively substitutes $record.* variables in a component's props and content
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
    children: component.children?.map((child: Component | string) =>
      typeof child === 'string'
        ? substituteRecordVars(child, record)
        : substituteRecordInComponent(child, record)
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

// ─── List-mode expansion ─────────────────────────────────────────────────────

/**
 * Expands a data-bound component's children once per record,
 * wrapping each record's expanded children in an <li> element.
 */
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

// ─── Database querying ──────────────────────────────────────────────────────

const DATA_SOURCE_OPERATOR_MAP: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
}

function buildFilterCondition(filter: DataFilter): string {
  const field = `"${sanitizeTableName(filter.field)}"`
  const { operator, value } = filter

  if (operator === 'contains') {
    return `${field} LIKE ${formatLikePattern(value, 'contains')}`
  }

  const sqlOp = DATA_SOURCE_OPERATOR_MAP[operator]
  if (sqlOp) {
    return `${field} ${sqlOp} ${formatSqlValue(value)}`
  }

  return `${field} = ${formatSqlValue(value)}`
}

function buildOrderByClause(sort: readonly DataSort[]): string {
  if (sort.length === 0) return ''
  const terms = sort.map((s) => {
    const field = `"${sanitizeTableName(s.field)}"`
    const dir = s.direction === 'desc' ? 'DESC' : 'ASC'
    return `${field} ${dir}`
  })
  return `ORDER BY ${terms.join(', ')}`
}

export interface TableQueryOptions {
  readonly fields?: readonly string[]
  readonly filter?: readonly DataFilter[]
  readonly sort?: readonly DataSort[]
  readonly pageSize?: number
  readonly page?: number
}

function buildSelectQuery(sanitized: string, options: TableQueryOptions): string {
  const { fields, filter, sort, pageSize, page } = options
  const columns =
    fields && fields.length > 0 ? fields.map((f) => `"${sanitizeTableName(f)}"`).join(', ') : '*'
  const whereClause =
    filter && filter.length > 0 ? `WHERE ${filter.map(buildFilterCondition).join(' AND ')}` : ''
  const orderByClause = sort && sort.length > 0 ? buildOrderByClause(sort) : ''
  const limitClause =
    pageSize && pageSize > 0 ? `LIMIT ${pageSize} OFFSET ${((page ?? 1) - 1) * pageSize}` : ''
  return [`SELECT ${columns} FROM "${sanitized}"`, whereClause, orderByClause, limitClause]
    .filter(Boolean)
    .join(' ')
}

export async function fetchTableRecords(
  tableName: string,
  options: TableQueryOptions = {}
): Promise<readonly Record<string, unknown>[]> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return []

  const sanitized = sanitizeTableName(tableName)
  const query = buildSelectQuery(sanitized, options)
  const sql = new SQL({ url: databaseUrl })
  try {
    const result = await sql.unsafe(query)
    return result as Record<string, unknown>[]
  } finally {
    sql.close()
  }
}

export async function countTableRecords(
  tableName: string,
  filter?: readonly DataFilter[]
): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return 0

  const sanitized = sanitizeTableName(tableName)
  const whereClause =
    filter && filter.length > 0 ? `WHERE ${filter.map(buildFilterCondition).join(' AND ')}` : ''

  const query = [`SELECT COUNT(*) AS count FROM "${sanitized}"`, whereClause]
    .filter(Boolean)
    .join(' ')

  const sql = new SQL({ url: databaseUrl })
  try {
    const result = await sql.unsafe(query)
    const rows = result as Array<{ count: number | string }>
    return Number(rows[0]?.count ?? 0)
  } finally {
    sql.close()
  }
}

export async function fetchSingleTableRecord(
  tableName: string,
  paramField: string,
  paramValue: string,
  fields?: readonly string[]
): Promise<Record<string, unknown> | undefined> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return undefined

  const sanitized = sanitizeTableName(tableName)
  const sanitizedField = sanitizeTableName(paramField)
  const columns =
    fields && fields.length > 0 ? fields.map((f) => `"${sanitizeTableName(f)}"`).join(', ') : '*'

  const formattedValue = formatSqlValue(paramValue)
  const sql = new SQL({ url: databaseUrl })
  try {
    const result = await sql.unsafe(
      `SELECT ${columns} FROM "${sanitized}" WHERE "${sanitizedField}" = ${formattedValue} LIMIT 1`
    )
    const rows = result as Record<string, unknown>[]
    return rows[0]
  } finally {
    sql.close()
  }
}

// ─── Single-record mode ──────────────────────────────────────────────────────

function applySingleRecordToComponent(
  component: Component,
  record: Record<string, unknown>
): Component {
  const substituted = substituteRecordInComponent(component, record)
  return {
    ...substituted,
    props: { ...(component.props ?? {}), _dataSourceBound: true },
  }
}

interface SingleModeOptions {
  readonly tableName: string
  readonly param: string | undefined
  readonly requestedFields: readonly string[] | undefined
  readonly routeParams: Readonly<Record<string, string>>
}

async function resolveSingleMode(
  component: Component,
  options: SingleModeOptions
): Promise<Component | typeof SINGLE_RECORD_NOT_FOUND> {
  const { tableName, param, requestedFields, routeParams } = options
  const paramName = param ?? tableName
  const paramValue = routeParams[paramName]
  if (!paramValue) {
    return withDataSourceError(component, `Error: route parameter "${paramName}" not found`)
  }
  const record = await fetchSingleTableRecord(tableName, paramName, paramValue, requestedFields)
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

async function resolveListMode(
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined
): Promise<Component> {
  const pagination = component.dataSource?.pagination
  const pageSize = pagination?.pageSize
  const filter = component.dataSource?.filter ?? undefined
  const sort = component.dataSource?.sort ?? undefined
  const queryOpts = { fields: requestedFields, filter, sort, pageSize, page: 1 }

  const [records, totalCount] = await Promise.all([
    fetchTableRecords(tableName, queryOpts),
    pageSize !== undefined ? countTableRecords(tableName, filter) : Promise.resolve(0),
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
  component: Component,
  tableName: string,
  requestedFields: readonly string[] | undefined
): Promise<Component> {
  // Fetch all records server-side so the island can filter client-side
  const records = await fetchTableRecords(tableName, {
    fields: requestedFields,
    filter: component.dataSource?.filter ?? undefined,
    sort: component.dataSource?.sort ?? undefined,
  })

  return { ...component, props: buildSearchProps(component, records) }
}

// ─── Section resolver ────────────────────────────────────────────────────────

async function resolveSection(
  section: Component | SimpleComponentReference | ComponentReference,
  app: App,
  routeParams: Readonly<Record<string, string>>
): Promise<DataSourceSectionResult> {
  if ('component' in section || '$ref' in section) return section

  const component = section as Component
  if (!component.dataSource) return component

  const { table: tableName, fields: requestedFields, mode, param } = component.dataSource
  const matchedTable = (app.tables ?? []).find((t) => t.name === tableName)

  if (!matchedTable) {
    return withDataSourceError(component, `Error: table "${tableName}" not found`)
  }

  const fieldError = checkFieldErrors(component, tableName, requestedFields, matchedTable.fields)
  if (fieldError) return fieldError

  if (mode === 'single') {
    return resolveSingleMode(component, { tableName, param, requestedFields, routeParams })
  }

  if (mode === 'search') {
    return resolveSearchMode(component, tableName, requestedFields)
  }

  return resolveListMode(component, tableName, requestedFields)
}

/**
 * Pre-processes page sections to resolve dataSource bindings asynchronously.
 *
 * Returns the resolved page, or undefined if any single-mode dataSource found no matching record.
 */
export async function resolvePageDataSources(
  page: Page,
  app: App,
  routeParams: Readonly<Record<string, string>>
): Promise<Page | undefined> {
  if (!page.sections || page.sections.length === 0) return page

  const resolvedSections = await Promise.all(
    page.sections.map((section) => resolveSection(section, app, routeParams))
  )

  if (resolvedSections.some((s) => s === SINGLE_RECORD_NOT_FOUND)) return undefined

  return {
    ...page,
    sections: resolvedSections.filter(
      (s): s is Component | SimpleComponentReference | ComponentReference =>
        s !== SINGLE_RECORD_NOT_FOUND
    ),
  }
}
