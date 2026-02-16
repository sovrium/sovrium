/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database'
import {
  buildAggregationSelects,
  parseAggregationResult,
  buildOrderByClause,
  buildWhereClause,
  checkDeletedAtColumn as checkDeletedAtColumnHelper,
} from '../query-helpers/aggregation-helpers'
import { buildTrashFilters, addTrashSorting } from '../query-helpers/trash-helpers'
import { wrapDatabaseError } from '../shared/error-handling'
import { typedExecute } from '../shared/typed-execute'
import { validateTableName } from '../shared/validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { SessionContextError } from '@/infrastructure/database'

/**
 * List all records from a table
 *
 * Returns all accessible records (Permissions applied via application layer).
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @param config.table - Table schema configuration (unused, kept for backward compatibility)
 * @param config.filter - Optional filter to apply to the query
 * @param config.includeDeleted - Whether to include soft-deleted records (default: false)
 * @param config.sort - Optional sort specification (e.g., 'field:asc' or 'field:desc')
 * @returns Effect resolving to array of records
 */
export function listRecords(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly table?: { readonly permissions?: { readonly organizationScoped?: boolean } }
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
  readonly sort?: string
  readonly app?: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  }
}): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  const { tableName, filter, includeDeleted, sort, app } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        // Build query clauses
        const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
        const orderByClause = buildOrderByClause(sort, app, tableName)

        return await typedExecute(
          tx,
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause}${orderByClause}`
        )
      }),
    catch: wrapDatabaseError(`Failed to list records from ${tableName}`),
  })
}

/**
 * Compute aggregations on records from a table
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @param config.filter - Optional filter to apply to the query
 * @param config.includeDeleted - Whether to include soft-deleted records (default: false)
 * @param config.aggregate - Aggregation configuration
 * @returns Effect resolving to aggregation results
 */

export function computeAggregations(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
  readonly aggregate: {
    readonly count?: boolean
    readonly sum?: readonly string[]
    readonly avg?: readonly string[]
    readonly min?: readonly string[]
    readonly max?: readonly string[]
  }
}): Effect.Effect<
  {
    readonly count?: string
    readonly sum?: Record<string, number>
    readonly avg?: Record<string, number>
    readonly min?: Record<string, number>
    readonly max?: Record<string, number>
  },
  SessionContextError
> {
  const { tableName, filter, includeDeleted, aggregate } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)
        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))
        const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
        const aggregationSelects = buildAggregationSelects(aggregate)
        if (aggregationSelects.length === 0) return {}

        const selectClause = sql.raw(aggregationSelects.join(', '))
        const rows = await typedExecute(
          tx,
          sql`SELECT ${selectClause} FROM ${sql.identifier(tableName)}${whereClause}`
        )
        if (rows.length === 0) return {}

        return parseAggregationResult(rows[0]!, aggregate)
      }),
    catch: wrapDatabaseError(`Failed to compute aggregations from ${tableName}`),
  })
}

/**
 * List soft-deleted records from a table
 *
 * Returns all accessible soft-deleted records (Permissions applied via application layer).
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @returns Effect resolving to array of soft-deleted records
 */
export function listTrash(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly sort?: string
}): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  const { tableName, filter, sort } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        if (!hasDeletedAt) {
          return [] as readonly Record<string, unknown>[]
        }

        const baseQuery = sql`SELECT * FROM ${sql.identifier(tableName)} WHERE deleted_at IS NOT NULL`
        const queryWithFilters = buildTrashFilters(baseQuery, filter?.and)
        const query = addTrashSorting(queryWithFilters, sort)

        return await typedExecute(tx, query)
      }),
    catch: wrapDatabaseError(`Failed to list trash from ${tableName}`),
  })
}

/**
 * Get a single record by ID
 *
 * Excludes soft-deleted records by default (deleted_at IS NULL).
 * Use includeDeleted parameter to fetch soft-deleted records.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param includeDeleted - Whether to include soft-deleted records (default: false)
 * @returns Effect resolving to record or null
 */
export function getRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  includeDeleted?: boolean
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        // Build WHERE clause with soft-delete filter if applicable
        const whereClause =
          hasDeletedAt && !includeDeleted
            ? sql` WHERE id = ${recordId} AND deleted_at IS NULL`
            : sql` WHERE id = ${recordId}`

        // Use parameterized query for recordId (automatic via template literal)
        const rows = await typedExecute(
          tx,
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause} LIMIT 1`
        )

        // eslint-disable-next-line unicorn/no-null -- Null is intentional for database records that don't exist
        return rows[0] ?? null
      }),
    catch: wrapDatabaseError(`Failed to get record ${recordId} from ${tableName}`),
  })
}
