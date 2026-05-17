/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hasReadPermission } from '@/application/use-cases/tables/permissions/permissions'
import { createListRecordsProgram } from '@/application/use-cases/tables/programs'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { passesTableRoleGate, resolveGuardForTable } from './row-level-guard'
import { buildListFilter, type FilterStructure } from './row-level-read-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Extract raw value from formattedFieldValue (may be plain value or { value, displayValue })
function getRawValue(fv: unknown): unknown {
  if (fv !== null && typeof fv === 'object' && 'value' in (fv as object)) {
    return (fv as { value: unknown }).value
  }
  return fv
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
 * Render a list of records to a CSV `Response` with table-config-ordered columns.
 * When `visibleFields` is provided, only those fields are included in the output.
 */
function buildCsvResponse(
  records: readonly { fields: Record<string, unknown> }[],
  tableFieldNames: readonly string[],
  tableName: string,
  visibleFields?: readonly string[]
): Response {
  const firstRecordFields = records[0]?.fields ?? {}
  const allFieldKeys = Object.keys(firstRecordFields)
  // Determine ordered field names: table config order first, then any extras
  const allOrderedFields =
    tableFieldNames.length > 0
      ? [
          ...tableFieldNames.filter((f) => allFieldKeys.includes(f)),
          ...allFieldKeys.filter((f) => !tableFieldNames.includes(f)),
        ]
      : allFieldKeys
  // Filter to only visible fields when specified
  const orderedFields =
    visibleFields && visibleFields.length > 0
      ? allOrderedFields.filter((f) => visibleFields.includes(f))
      : allOrderedFields

  const header = orderedFields.map(escapeCsvValue).join(',')
  const rows = records.map((record) =>
    orderedFields.map((f) => escapeCsvValue(getRawValue(record.fields[f]))).join(',')
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
function buildEmptyCsvResponse(tableFieldNames: readonly string[], tableName: string): Response {
  const header = tableFieldNames.join(',')
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

function buildJsonResponse(
  records: readonly { fields: Record<string, unknown> }[],
  tableName: string
): Response {
  const data = records.map((record) =>
    Object.fromEntries(Object.entries(record.fields).map(([k, v]) => [k, getRawValue(v)]))
  )
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
  readonly guard: ReturnType<typeof resolveGuardForTable> extends Promise<infer T> ? T : never
}

/**
 * Z-3 read role gate for CSV export. Mirrors the list-records contract:
 *   - row-level-enforced tables → role-gate against the overlay roles
 *   - non-row-level tables → canonical hasReadPermission
 * Returns 403 (FORBIDDEN) on failure — list-mode uses 403 because the
 * user explicitly requested an action they don't have authority for.
 */
function checkExportReadGate(input: ExportReadGateInput): Response | undefined {
  const { c, app, table, userRole, guard } = input
  if (guard) {
    if (passesTableRoleGate(table?.permissions, 'read', guard.effectiveRoles)) return undefined
  } else if (hasReadPermission(table, userRole, app.tables)) {
    return undefined
  }
  return c.json(
    {
      success: false,
      message: 'You do not have permission to perform this action',
      code: 'FORBIDDEN',
    },
    403
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
function buildEmptyExportResponse(format: string, tableName: string, tableFieldNames: string[]) {
  if (format === 'json') return buildJsonResponse([], tableName)
  return buildEmptyCsvResponse(tableFieldNames, tableName)
}

export async function handleExportTableCsv(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table)

  const gateError = checkExportReadGate({ c, app, table, userRole, guard })
  if (gateError) return gateError

  const { filter, format, visibleFields } = parseExportQuery(c)
  const tableFieldNames = table?.fields?.map((f) => f.name) ?? []

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
    return buildEmptyExportResponse(format, tableName, tableFieldNames)
  }

  const program = createListRecordsProgram({
    session,
    tableName,
    app,
    userRole,
    filter: finalFilter,
    limit: Number.MAX_SAFE_INTEGER,
  })
  const either = await Effect.runPromise(Effect.either(provideTableLive(program)))
  if (either._tag === 'Left') {
    return c.json({ success: false, message: 'Export failed', code: 'INTERNAL_ERROR' }, 500)
  }
  if (format === 'json') return buildJsonResponse(either.right.records, tableName)
  return buildCsvResponse(either.right.records, tableFieldNames, tableName, visibleFields)
}
