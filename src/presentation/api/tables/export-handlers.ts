/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { createListRecordsProgram } from '@/application/use-cases/tables/list-records-program'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { escapeCsvCell } from '@/domain/kernel/format/csv-format'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { NUMBER_FIELD_TYPES } from '@/domain/models/app/tables/stored-value-service'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import {
  csvCellValue,
  jsonExportRow,
  orderExportColumns,
  relationshipFieldNames,
  type ExportRecord,
} from './export-cells'
import { readerExportColumns } from './export-columns'
import {
  csvColumnsOf,
  languageCellValue,
  languageColumnsOf,
  type CsvColumn,
} from './export-language-columns'
import { validateFilterParam } from './field-permission-validation'
import { passesTableRoleGate, resolveGuardForTable } from './row-level-guard'
import { buildListFilter, type FilterStructure } from './row-level-read-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Attachment columns whose read-path value is enriched: the records
 * program promotes a bare storage key into `{ key, signedUrl, ... }` and a key
 * list into an array of those.
 */
const ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'single-attachment',
  'multiple-attachments',
])

/**
 * Names of the table's number columns. The CSV escaper writes their cells
 * as-is even when a driver hands the value over as text (a `decimal`, or a
 * PostgreSQL `numeric`), so a negative amount is never prefixed as a formula.
 */
function numberFieldNames(table: ReturnType<NonNullable<App['tables']>['find']>): Set<string> {
  return new Set(
    (table?.fields ?? []).filter((f) => NUMBER_FIELD_TYPES.has(f.type)).map((f) => f.name)
  )
}

/** Names of the table's attachment columns, used to scope the export's attachment unwrapping. */
function attachmentFieldNames(table: ReturnType<NonNullable<App['tables']>['find']>): Set<string> {
  return new Set(
    (table?.fields ?? []).filter((f) => ATTACHMENT_FIELD_TYPES.has(f.type)).map((f) => f.name)
  )
}

/**
 * Build an AND-filter from `?filterField=&filterValue=` (single equals) and/or
 * `?recordIds=` (id IN (...)) query params. Returns `undefined` when no filter
 * inputs are provided. Shape matches `ListRecordsConfig['filter']`.
 *
 * `recordIds` powers "Export selected" — the data-table island sends a
 * comma-separated id list when the user checks specific rows and clicks
 * Export selected. When both filter inputs are present they are AND-merged
 * (e.g. an active toolbar filter intersected with the user's selection).
 */
type ExportFilterClause = {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

function buildExportFilter(
  filterField: string | undefined,
  filterValue: string | undefined,
  recordIds: readonly string[] | undefined
): { and: readonly ExportFilterClause[] } | undefined {
  const equalsClause: ExportFilterClause | undefined =
    filterField !== undefined && filterField !== '' && filterValue !== undefined
      ? { field: filterField, operator: 'equals', value: filterValue }
      : undefined
  const idsClause: ExportFilterClause | undefined =
    recordIds !== undefined && recordIds.length > 0
      ? { field: 'id', operator: 'in', value: recordIds }
      : undefined

  const conditions = [equalsClause, idsClause].filter(
    (c): c is ExportFilterClause => c !== undefined
  )
  return conditions.length > 0 ? { and: conditions } : undefined
}

/**
 * Render a list of records to a CSV `Response`: columns in table order, or in
 * the order `visibleFields` names them when it is provided.
 */
function buildCsvResponse(
  records: readonly ExportRecord[],
  tableFieldNames: readonly string[],
  tableName: string,
  opts: {
    readonly attachments: ReadonlySet<string>
    readonly links: ReadonlySet<string>
    readonly numbers: ReadonlySet<string>
    readonly visibleFields?: readonly string[]
    readonly withheld: ReadonlySet<string>
    readonly languages: ReadonlyMap<string, readonly string[]>
  }
): Response {
  const { numbers, visibleFields, withheld } = opts
  // Columns come from EVERY record, never one: a lookup left out of the first
  // row (its linked record hidden from this reader) must not drop the column
  // for the rows that carry it. A readable field the request named in
  // `fields=` keeps its column even when no row carries a value for it.
  // A column the reader may not read has no place, even named in `fields=`.
  const present = [...new Set(records.flatMap((record) => Object.keys(record.fields)))].filter(
    (f) => !withheld.has(f)
  )
  const named = new Set((visibleFields ?? []).filter((f) => !withheld.has(f)))
  const allOrderedFields =
    tableFieldNames.length > 0
      ? [
          ...tableFieldNames.filter((f) => present.includes(f) || named.has(f)),
          ...present.filter((f) => !tableFieldNames.includes(f)),
        ]
      : present
  const orderedFields = orderExportColumns(allOrderedFields, tableFieldNames, visibleFields)

  // A translatable field is one column per declared language.
  const columns = csvColumnsOf(orderedFields, opts.languages)
  const header = columns.map((column) => escapeCsvCell(column.header)).join(',')
  const cell = (record: ExportRecord, column: CsvColumn): unknown => {
    const value = csvCellValue(record, column.field, opts)
    return column.language === undefined ? value : languageCellValue(value, column.language)
  }
  const rows = records.map((record) =>
    columns
      .map((column) => escapeCsvCell(cell(record, column), { numeric: numbers.has(column.field) }))
      .join(',')
  )
  const csvContent = [header, ...rows].join('\n') + '\n'
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${tableName}-${date}.csv`

  return new Response(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/**
 * Build the empty CSV response for callers whose row-level read predicate
 * resolves to "match nothing" (e.g. user has no assignments). The header
 * row is still emitted so downstream tools that auto-detect column shape
 * don't break.
 */
function buildEmptyCsvResponse(
  tableFieldNames: readonly string[],
  tableName: string,
  languages: ReadonlyMap<string, readonly string[]>
): Response {
  const header = csvColumnsOf(tableFieldNames, languages)
    .map((column) => escapeCsvCell(column.header))
    .join(',')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${tableName}-${date}.csv`
  return new Response(header + '\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/**
 * Render a list of records to a JSON `Response`: each record named by its id,
 * then its readable fields — those `visibleFields` names, in its order, when
 * it is provided. A link keeps its ids, for a program to follow.
 */
function buildJsonResponse(
  records: readonly ExportRecord[],
  tableName: string,
  opts: {
    readonly attachments: ReadonlySet<string>
    readonly visibleFields?: readonly string[]
    readonly withheld: ReadonlySet<string>
  }
): Response {
  const data = records.map((record) => jsonExportRow(record, opts))
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${tableName}-${date}.json`

  return new Response(JSON.stringify(data, undefined, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

interface ExportReadGateInput {
  readonly c: Context
  readonly app: App
  readonly table: ReturnType<NonNullable<App['tables']>['find']>
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly guard: ReturnType<typeof resolveGuardForTable> extends Promise<infer T> ? T : never
}

/**
 * Z-3 read role gate for CSV export. Mirrors the list-records contract:
 *   - row-level-enforced tables → role-gate against the overlay roles
 *   - non-row-level tables → canonical group-aware read evaluator
 * A refusal answers the 404 of a table that does not exist (S1): the export
 * must not tell a table the caller may not read apart from an absent one.
 *
 * Both branches resolve the caller's effective roles. The `else` branch — every
 * table declaring no `rowLevelPermissions`, which is the default — used to gate
 * on the bare role, so a `read: ['group:ops']` grant that the records API
 * honoured answered 403 here: same data, two answers, depending on which button
 * the user pressed.
 */
function checkExportReadGate(input: ExportReadGateInput): Response | undefined {
  const { c, app, table, userRole, userGroups, guard } = input
  if (guard) {
    if (passesTableRoleGate(table, 'read', guard)) return undefined
  } else if (hasReadPermissionForRoles(table, buildEffectiveRoles(userRole, userGroups), app)) {
    return undefined
  }
  return notFound(c)
}

/**
 * Every read gate the export must clear, in order: the table-level role gate,
 * then the field-level check on the caller-supplied `?filterField=`.
 *
 * The second is easy to miss: without it, export would reach the records
 * program with no field check on any of its filter inputs. Omitting the hidden COLUMN
 * from the CSV is not the protection: which ROWS come back is one bit per
 * request, so a member could sweep `filterValue` and reconstruct an admin-only
 * column while every other route on that field answered 404.
 */
function checkExportGates(
  input: ExportReadGateInput & {
    readonly tableName: string
    readonly filter: ReturnType<typeof buildExportFilter>
  }
): Response | undefined {
  const { c, app, table, tableName, userRole, userGroups, guard, filter } = input
  return (
    checkExportReadGate({ c, app, table, userRole, userGroups, guard }) ??
    validateFilterParam(filter, { app, tableName, userRole, userGroups, c })
  )
}

/**
 * Parse the export query string into the inputs the handler actually needs.
 * Pulled out to drop a handful of statements and one branch from the main
 * handler so its size/complexity stays under the size-limit thresholds.
 */
function parseExportQuery(c: Context): {
  readonly filter: ReturnType<typeof buildExportFilter>
  readonly format: string
  readonly visibleFields: readonly string[] | undefined
} {
  const recordIdsParam = c.req.query('recordIds')
  const recordIds = recordIdsParam
    ? recordIdsParam
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '')
    : undefined
  const filter = buildExportFilter(
    c.req.query('filterField'),
    c.req.query('filterValue'),
    recordIds
  )
  const format = c.req.query('format') ?? 'csv'
  const fieldsParam = c.req.query('fields')
  const visibleFields = fieldsParam ? fieldsParam.split(',').map((f) => f.trim()) : undefined
  return { filter, format, visibleFields }
}

/** Build the empty-set response in the requested format. */
function buildEmptyExportResponse(
  format: string,
  tableName: string,
  tableFieldNames: string[],
  languages: ReadonlyMap<string, readonly string[]>
) {
  if (format === 'json') {
    return buildJsonResponse([], tableName, { attachments: new Set(), withheld: new Set() })
  }
  return buildEmptyCsvResponse(tableFieldNames, tableName, languages)
}

export async function handleExportTableCsv(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

  const { filter, format, visibleFields } = parseExportQuery(c)

  const gateError = checkExportGates({
    c,
    app,
    table,
    tableName,
    userRole,
    userGroups,
    guard,
    filter,
  })
  if (gateError) return gateError

  // Column NAMES are a read surface too: the empty export emits this list as
  // its header, and the populated one takes its column ORDER from it.
  const reader = { session, role: userRole, groups: userGroups }
  const { withheld, tableFieldNames } = await readerExportColumns(c, app, table, reader)
  const languages = languageColumnsOf(app, tableName)

  // Z-3 read predicate: AND-merge the row-level read clause onto the
  // request-supplied filter. Sentinels short-circuit to an empty response
  // when the predicate resolves to "match nothing" or fails projection.
  const finalFilter: FilterStructure | 'empty' | 'reject' = buildListFilter(
    table,
    guard,
    undefined,
    filter as FilterStructure
  )
  if (finalFilter === 'empty' || finalFilter === 'reject') {
    return buildEmptyExportResponse(format, tableName, tableFieldNames, languages)
  }

  const program = createListRecordsProgram({
    session,
    tableName,
    app,
    userRole,
    userGroups,
    filter: finalFilter,
    limit: Number.MAX_SAFE_INTEGER,
  })
  const either = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  // A table whose reader may read no field fails the list as a table that
  // does not exist, and the export answers it as such — CSV and JSON alike.
  if (either._tag === 'Failure') return toErrorResponse(c, either.failure)
  const shape = { attachments: attachmentFieldNames(table), visibleFields, withheld }
  if (format === 'json') return buildJsonResponse(either.success.records, tableName, shape)
  return buildCsvResponse(either.success.records, tableFieldNames, tableName, {
    ...shape,
    links: relationshipFieldNames(table),
    numbers: numberFieldNames(table),
    languages,
  })
}
