/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Layer } from 'effect'
import {
  DataSourceRepository,
  DataSourceDatabaseError,
} from '@/application/ports/repositories/data-source-repository'
import { formatLikePattern, formatSqlValue } from '@/domain/utils/sql-formatting'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import type { DataSourceQueryOptions } from '@/application/ports/repositories/data-source-repository'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

const wrap = makeDbWrap((error) => new DataSourceDatabaseError({ cause: error }))


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

  if (operator === 'in') {
    return buildInClause(field, value)
  }

  const sqlOp = DATA_SOURCE_OPERATOR_MAP[operator]
  if (sqlOp) {
    return `${field} ${sqlOp} ${formatSqlValue(value)}`
  }

  return `${field} = ${formatSqlValue(value)}`
}

function buildInClause(field: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '1 = 0'
    const literals = value.map((v) => formatSqlValue(v)).join(', ')
    return `${field} IN (${literals})`
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

function buildSelectQuery(sanitized: string, options: DataSourceQueryOptions): string {
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

function buildWhereClause(filter: readonly DataFilter[]): string {
  if (filter.length === 0) return ''
  return `WHERE ${filter.map(buildFilterCondition).join(' AND ')}`
}


async function executeQuery<T>(query: string): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return [] as unknown as T

  const sql = new SQL({ url: databaseUrl })
  try {
    return (await sql.unsafe(query)) as T
  } finally {
    sql.close()
  }
}


export const DataSourceRepositoryLive = Layer.succeed(DataSourceRepository, {
  fetchRecords: (tableName, options = {}) =>
    wrap(async () => {
      const sanitized = sanitizeTableName(tableName)
      const query = buildSelectQuery(sanitized, options)
      return await executeQuery<Record<string, unknown>[]>(query)
    }),

  countRecords: (tableName, filter) =>
    wrap(async () => {
      const sanitized = sanitizeTableName(tableName)
      const whereClause = filter && filter.length > 0 ? buildWhereClause(filter) : ''
      const query = [`SELECT COUNT(*) AS count FROM "${sanitized}"`, whereClause]
        .filter(Boolean)
        .join(' ')
      const rows = await executeQuery<Array<{ count: number | string }>>(query)
      return Number(rows[0]?.count ?? 0)
    }),

  fetchSingleRecord: (tableName, paramField, paramValue, fields) =>
    wrap(async () => {
      const sanitized = sanitizeTableName(tableName)
      const sanitizedField = sanitizeTableName(paramField)
      const columns =
        fields && fields.length > 0
          ? fields.map((f) => `"${sanitizeTableName(f)}"`).join(', ')
          : '*'
      const formattedValue = formatSqlValue(paramValue)
      const query = `SELECT ${columns} FROM "${sanitized}" WHERE "${sanitizedField}" = ${formattedValue} LIMIT 1`
      const rows = await executeQuery<Record<string, unknown>[]>(query)
      return rows[0]
    }),

  fetchUserAssignments: (userId, tableSlug) =>
    wrap(async () => {
      const escapedUserId = formatSqlValue(userId)
      const escapedSlug = formatSqlValue(tableSlug)
      const query = `SELECT "record_ids" FROM "system"."user_access" WHERE "user_id" = ${escapedUserId} AND "table_slug" = ${escapedSlug}`
      try {
        const rows = await executeQuery<Array<{ record_ids: readonly string[] | null }>>(query)
        const flattened = rows.flatMap((row) =>
          Array.isArray(row.record_ids) ? row.record_ids : []
        )
        return flattened
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/relation .*user_access.* does not exist/i.test(message)) {
          return [] as readonly string[]
        }
        throw error
      }
    }),

  fetchUserAccessRoles: (userId) =>
    wrap(async () => {
      const escapedUserId = formatSqlValue(userId)
      const query = `SELECT DISTINCT "role" FROM "system"."user_access" WHERE "user_id" = ${escapedUserId}`
      try {
        const rows = await executeQuery<Array<{ role: string | null }>>(query)
        return rows
          .map((row) => row.role)
          .filter((role): role is string => typeof role === 'string' && role.length > 0)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/relation .*user_access.* does not exist/i.test(message)) {
          return [] as readonly string[]
        }
        throw error
      }
    }),
})
