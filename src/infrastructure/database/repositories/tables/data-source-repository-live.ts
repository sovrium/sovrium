/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  DataSourceRepository,
  DataSourceDatabaseError,
} from '@/application/ports/repositories/tables/data-source-repository'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { formatLikePattern, formatSqlValue } from '@/domain/utils/database/sql-formatting'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database/drizzle/db-bun'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { DataSourceQueryOptions } from '@/application/ports/repositories/tables/data-source-repository'
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
  return (await executeRaw(db, sql.raw(query))) as unknown as T
}

const userAccessTableRef = (): string =>
  isSqliteRuntime() ? `"system_user_access"` : `"system"."user_access"`

const causeChainMessages = (error: unknown, depth = 0): readonly string[] => {
  if (depth >= 6 || error === null || typeof error !== 'object') return []
  const node = error as { readonly message?: unknown; readonly cause?: unknown }
  const own = typeof node.message === 'string' ? [node.message] : []
  return [...own, ...causeChainMessages(node.cause, depth + 1)]
}

const isMissingUserAccessTable = (error: unknown): boolean =>
  causeChainMessages(error).some(
    (message) =>
      /relation .*user_access.* does not exist/i.test(message) ||
      /no such table:.*user_access/i.test(message)
  )

const toRecordIdList = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value as readonly string[]
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as readonly string[]) : []
  } catch {
    return []
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
      return toFiniteCount(rows[0]?.count)
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
      const query = `SELECT "record_ids" FROM ${userAccessTableRef()} WHERE "user_id" = ${escapedUserId} AND "table_slug" = ${escapedSlug}`
      try {
        const rows = await executeQuery<Array<{ record_ids: unknown }>>(query)
        const flattened = rows.flatMap((row) => toRecordIdList(row.record_ids))
        return flattened
      } catch (error) {
        if (isMissingUserAccessTable(error)) {
          return [] as readonly string[]
        }
        throw error
      }
    }),

  fetchUserAccessRoles: (userId) =>
    wrap(async () => {
      const escapedUserId = formatSqlValue(userId)
      const query = `SELECT DISTINCT "role" FROM ${userAccessTableRef()} WHERE "user_id" = ${escapedUserId}`
      try {
        const rows = await executeQuery<Array<{ role: string | null }>>(query)
        return rows
          .map((row) => row.role)
          .filter((role): role is string => typeof role === 'string' && role.length > 0)
      } catch (error) {
        if (isMissingUserAccessTable(error)) {
          return [] as readonly string[]
        }
        throw error
      }
    }),
})
