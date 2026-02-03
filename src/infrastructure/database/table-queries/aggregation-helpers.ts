/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database'
import { generateSqlCondition } from '../filter-operators'
import { validateColumnName } from './validation'

/**
 * Build SQL aggregation SELECT clauses for requested operations
 */
export function buildAggregationSelects(aggregate: {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}): readonly string[] {
  const countSelect = aggregate.count ? ['COUNT(*)::text as count'] : []

  const sumSelects =
    aggregate.sum?.map((field) => {
      validateColumnName(field)
      return `SUM("${field}") as sum_${field}`
    }) ?? []

  const avgSelects =
    aggregate.avg?.map((field) => {
      validateColumnName(field)
      return `AVG("${field}") as avg_${field}`
    }) ?? []

  const minSelects =
    aggregate.min?.map((field) => {
      validateColumnName(field)
      return `MIN("${field}") as min_${field}`
    }) ?? []

  const maxSelects =
    aggregate.max?.map((field) => {
      validateColumnName(field)
      return `MAX("${field}") as max_${field}`
    }) ?? []

  return [...countSelect, ...sumSelects, ...avgSelects, ...minSelects, ...maxSelects]
}

/**
 * Parse count aggregation from result row
 */
function parseCountAggregation(
  row: Record<string, unknown>,
  aggregate: { readonly count?: boolean }
): { readonly count?: string } {
  return aggregate.count && row['count'] !== undefined ? { count: String(row['count']) } : {}
}

/**
 * Parse numeric aggregation fields (sum, avg, min, max)
 */
function parseNumericAggregation(
  row: Record<string, unknown>,
  fields: readonly string[],
  prefix: string
): Record<string, number> {
  return fields.reduce<Record<string, number>>((acc, field) => {
    const key = `${prefix}_${field}`
    if (row[key] !== null && row[key] !== undefined) {
      return { ...acc, [field]: Number(row[key]) }
    }
    return acc
  }, {})
}

/**
 * Parse aggregation result row into structured aggregation object
 */
export function parseAggregationResult(
  row: Record<string, unknown>,
  aggregate: {
    readonly count?: boolean
    readonly sum?: readonly string[]
    readonly avg?: readonly string[]
    readonly min?: readonly string[]
    readonly max?: readonly string[]
  }
): {
  readonly count?: string
  readonly sum?: Record<string, number>
  readonly avg?: Record<string, number>
  readonly min?: Record<string, number>
  readonly max?: Record<string, number>
} {
  const countAgg = parseCountAggregation(row, aggregate)

  const sumAgg =
    aggregate.sum && aggregate.sum.length > 0
      ? { sum: parseNumericAggregation(row, aggregate.sum, 'sum') }
      : {}

  const avgAgg =
    aggregate.avg && aggregate.avg.length > 0
      ? { avg: parseNumericAggregation(row, aggregate.avg, 'avg') }
      : {}

  const minAgg =
    aggregate.min && aggregate.min.length > 0
      ? { min: parseNumericAggregation(row, aggregate.min, 'min') }
      : {}

  const maxAgg =
    aggregate.max && aggregate.max.length > 0
      ? { max: parseNumericAggregation(row, aggregate.max, 'max') }
      : {}

  return {
    ...countAgg,
    ...sumAgg,
    ...avgAgg,
    ...minAgg,
    ...maxAgg,
  }
}

/**
 * Check if table has deleted_at column
 */
export function checkDeletedAtColumn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tableName: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const columnCheck = (await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
      )) as readonly Record<string, unknown>[]

      return columnCheck.length > 0
    },
    catch: (error) =>
      new SessionContextError(`Failed to check deleted_at column for ${tableName}`, error),
  })
}

/**
 * Build filter conditions from user-provided filters
 */
export function buildUserFilterConditions(filter?: {
  readonly and?: readonly {
    readonly field: string
    readonly operator: string
    readonly value: unknown
  }[]
}): readonly string[] {
  if (!filter?.and || filter.and.length === 0) return []

  const andConditions = filter.and ?? []
  return andConditions
    .map((f) => {
      validateColumnName(f.field)
      return generateSqlCondition(f.field, f.operator, f.value, {
        useEscapeSqlString: true,
      })
    })
    .filter((c) => c !== '')
}

/**
 * Find field definition in app schema
 */
function findFieldDefinition(
  app: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  },
  tableName: string,
  fieldName: string
): { readonly type?: string; readonly options?: readonly string[] } | undefined {
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.fields.find((f: { readonly name?: string }) => f.name === fieldName) as
    | { readonly type?: string; readonly options?: readonly string[] }
    | undefined
}

/**
 * Build CASE expression for single-select field sorting
 */
function buildSingleSelectCaseExpression(
  field: string,
  options: readonly string[],
  direction: string
): string {
  const caseWhen = options
    .map((opt, idx) => `WHEN "${field}" = '${opt.replace(/'/g, "''")}' THEN ${idx}`)
    .join(' ')
  return `CASE ${caseWhen} END ${direction}`
}

/**
 * Build sort clause for a single field
 */
function buildSortClause(
  field: string,
  direction: string | undefined,
  app?: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  },
  tableName?: string
): string {
  validateColumnName(field)
  const dir = direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'

  // Check if this is a single-select field with options
  if (app && tableName) {
    const fieldDef = findFieldDefinition(app, tableName, field)

    if (fieldDef?.type === 'single-select' && fieldDef.options && fieldDef.options.length > 0) {
      return buildSingleSelectCaseExpression(field, fieldDef.options, dir)
    }
  }

  return `"${field}" ${dir}`
}

/**
 * Build ORDER BY clause from sort parameter
 * @param sort - Sort parameter (e.g., 'field:asc' or 'field:desc')
 * @param app - Optional App config for single-select field option ordering
 * @param tableName - Optional table name for single-select field lookups
 */
export function buildOrderByClause(
  sort?: string,
  app?: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  },
  tableName?: string
): Readonly<ReturnType<typeof sql.raw>> {
  if (!sort) return sql.raw('')

  const sortParts = sort.split(',').map((part) => part.trim())
  const orderClauses = sortParts
    .map((part) => {
      const [field, direction] = part.split(':')
      if (!field) return ''
      return buildSortClause(field, direction, app, tableName)
    })
    .filter((c) => c !== '')

  return orderClauses.length > 0 ? sql.raw(` ORDER BY ${orderClauses.join(', ')}`) : sql.raw('')
}

/**
 * Build WHERE clause from filter conditions
 */
export function buildWhereClause(
  hasDeletedAt: boolean,
  includeDeleted: boolean | undefined,
  filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
): Readonly<ReturnType<typeof sql.raw>> {
  const userFilterConditions = buildUserFilterConditions(filter)
  const softDeleteCondition = hasDeletedAt && !includeDeleted ? ['deleted_at IS NULL'] : []
  const conditions = [...userFilterConditions, ...softDeleteCondition]

  return conditions.length > 0 ? sql.raw(` WHERE ${conditions.join(' AND ')}`) : sql.raw('')
}
