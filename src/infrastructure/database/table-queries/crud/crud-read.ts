/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database'
import { authUserTableRef } from '@/infrastructure/database/sql/dialect-sql'
import { withTransaction } from '@/infrastructure/database/transaction'
import { traceDbQuery } from '@/infrastructure/telemetry/db-query-trace'
import {
  buildAggregationSelects,
  parseAggregationResult,
  buildOrderByClause,
  buildPageClause,
  buildSelectListClause,
  buildWhereClause,
  checkDeletedAtColumn as checkDeletedAtColumnHelper,
  checkAuthorshipColumns,
  type FilterNode,
  type OrderByAppView,
  type OrderByPrimaryKey,
} from '../query-helpers/aggregation-helpers'
import { buildTrashFilters, addTrashSorting } from '../query-helpers/trash-helpers'
import { wrapDatabaseError } from '../statement/error-handling'
import { typedExecute } from '../statement/typed-execute'
import { validateTableName } from '../statement/validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { DatabaseError, DrizzleTransaction } from '@/infrastructure/database'

/**
 * List all records from a table
 *
 * Returns all accessible records (Permissions applied via application layer).
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @param config.filter - Optional filter to apply to the query
 * @param config.includeDeleted - Whether to include soft-deleted records (default: false)
 * @param config.sort - Optional sort specification (e.g., 'field:asc' or 'field:desc')
 * @param config.limit - Optional page size, applied as SQL `LIMIT`
 * @param config.offset - Optional start offset, applied as SQL `OFFSET`
 * @param config.columns - Optional projection; omit for `SELECT *`
 * @returns Effect resolving to array of records
 */
export function listRecords(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly filter?: {
    readonly and?: readonly FilterNode[]
  }
  readonly includeDeleted?: boolean
  readonly sort?: string
  readonly limit?: number
  readonly offset?: number
  readonly columns?: readonly string[]
  readonly app?: OrderByAppView
  /**
   * The table's declared primary key. Consulted ONLY to pick the default sort
   * key for a request that supplied no `sort` — a table keyed on a composite of
   * its own columns has no `id` column to order by. See `buildOrderByClause`.
   */
  readonly primaryKey?: OrderByPrimaryKey
}): Effect.Effect<readonly Record<string, unknown>[], DatabaseError> {
  const { tableName, filter, includeDeleted, sort, limit, offset, columns, app, primaryKey } =
    config
  const onFailure = wrapDatabaseError(`Failed to list records from ${tableName}`)
  return traceDbQuery(
    'select',
    tableName,
    withTransaction(
      db,
      (tx) =>
        Effect.gen(function* () {
          validateTableName(tableName)

          const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)

          // Build query clauses
          const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
          const orderByClause = buildOrderByClause(sort, app, tableName, primaryKey)
          // Empty when the caller passes neither `limit` nor `offset`, which is
          // every pre-pagination call site — the statement below is unchanged
          // for them, down to the byte.
          const pageClause = buildPageClause(limit, offset)
          // `*` unless the caller projected. `ORDER BY` deliberately runs
          // against the FULL relation rather than the projected list: a plain
          // non-DISTINCT select may order by a column it does not return, on
          // both dialects, so a sort key never has to be force-projected.
          const selectList = yield* buildSelectListClause(tx, tableName, columns)

          return yield* Effect.tryPromise({
            try: () =>
              typedExecute(
                tx,
                sql`SELECT ${selectList} FROM ${sql.identifier(tableName)}${whereClause}${orderByClause}${pageClause}`
              ),
            catch: onFailure,
          })
        }),
      onFailure
    )
  )
}

/** The aggregate spec a caller asks for, named once so the query below can be extracted. */
type AggregationSpec = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

/** What {@link computeAggregations} resolves to. */
type AggregationResult = {
  readonly count?: string
  readonly sum?: Record<string, number>
  readonly avg?: Record<string, number>
  readonly min?: Record<string, number>
  readonly max?: Record<string, number>
}

/**
 * The aggregation SELECT, as it runs against the open transaction.
 *
 * Extracted from {@link computeAggregations} only so that function stays inside
 * the size limit — its inline result type is most of its length. `onFailure` is
 * the SAME mapper the surrounding `withTransaction` uses, so a rejection here
 * and a rejection from the transaction itself produce the identical error.
 */
const runAggregationsInTx = (
  tx: Readonly<DrizzleTransaction>,
  params: {
    readonly tableName: string
    readonly filter?: { readonly and?: readonly FilterNode[] }
    readonly includeDeleted?: boolean
    readonly aggregate: AggregationSpec
  },
  // eslint-disable-next-line functional/prefer-immutable-types -- receives the shared `wrapDatabaseError` factory, which returns a mutable Error subclass; same rationale as the file-level disable in `shared/error-handling.ts`
  onFailure: (error: unknown) => DatabaseError
): Effect.Effect<AggregationResult, DatabaseError> =>
  Effect.gen(function* () {
    const { tableName, filter, includeDeleted, aggregate } = params
    validateTableName(tableName)
    const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)
    const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
    const aggregationSelects = buildAggregationSelects(aggregate)
    if (aggregationSelects.length === 0) return {}

    const selectClause = sql.raw(aggregationSelects.join(', '))
    const rows = yield* Effect.tryPromise({
      try: () =>
        typedExecute(
          tx,
          sql`SELECT ${selectClause} FROM ${sql.identifier(tableName)}${whereClause}`
        ),
      catch: onFailure,
    })
    if (rows.length === 0) return {}

    return parseAggregationResult(rows[0]!, aggregate)
  })

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
    readonly and?: readonly FilterNode[]
  }
  readonly includeDeleted?: boolean
  readonly aggregate: AggregationSpec
}): Effect.Effect<AggregationResult, DatabaseError> {
  const { tableName, filter, includeDeleted, aggregate } = config
  const onFailure = wrapDatabaseError(`Failed to compute aggregations from ${tableName}`)
  return traceDbQuery(
    'select',
    tableName,
    withTransaction(
      db,
      (tx) => runAggregationsInTx(tx, { tableName, filter, includeDeleted, aggregate }, onFailure),
      onFailure
    )
  )
}

/**
 * Build SELECT field list for authorship columns
 */
function buildAuthorshipSelectFields(authorshipColumns: {
  readonly hasCreatedBy: boolean
  readonly hasUpdatedBy: boolean
  readonly hasDeletedBy: boolean
}): readonly string[] {
  const createdByFields = authorshipColumns.hasCreatedBy
    ? [
        'created_by_user.id AS "createdByUserId"',
        'created_by_user.name AS "createdByUserName"',
        'created_by_user.email AS "createdByUserEmail"',
      ]
    : []

  const updatedByFields = authorshipColumns.hasUpdatedBy
    ? [
        'updated_by_user.id AS "updatedByUserId"',
        'updated_by_user.name AS "updatedByUserName"',
        'updated_by_user.email AS "updatedByUserEmail"',
      ]
    : []

  const deletedByFields = authorshipColumns.hasDeletedBy
    ? [
        'deleted_by_user.id AS "deletedByUserId"',
        'deleted_by_user.name AS "deletedByUserName"',
        'deleted_by_user.email AS "deletedByUserEmail"',
      ]
    : []

  return ['t.*', ...createdByFields, ...updatedByFields, ...deletedByFields]
}

/**
 * Build query with conditional JOINs for authorship tables
 */
function buildAuthorshipJoins(
  baseQuery: Readonly<ReturnType<typeof sql>>,
  authorshipColumns: {
    readonly hasCreatedBy: boolean
    readonly hasUpdatedBy: boolean
    readonly hasDeletedBy: boolean
  }
): Readonly<ReturnType<typeof sql>> {
  const authUser = authUserTableRef()
  const queryWithCreatedBy = authorshipColumns.hasCreatedBy
    ? sql`${baseQuery} LEFT JOIN ${authUser} created_by_user ON t.created_by = created_by_user.id`
    : baseQuery

  const queryWithUpdatedBy = authorshipColumns.hasUpdatedBy
    ? sql`${queryWithCreatedBy} LEFT JOIN ${authUser} updated_by_user ON t.updated_by = updated_by_user.id`
    : queryWithCreatedBy

  const queryWithDeletedBy = authorshipColumns.hasDeletedBy
    ? sql`${queryWithUpdatedBy} LEFT JOIN ${authUser} deleted_by_user ON t.deleted_by = deleted_by_user.id`
    : queryWithUpdatedBy

  return queryWithDeletedBy
}

/**
 * Transform row data to include user objects for authorship fields
 */
function transformRowWithAuthorship(
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const {
    createdByUserId,
    createdByUserName,
    createdByUserEmail,
    updatedByUserId,
    updatedByUserName,
    updatedByUserEmail,
    deletedByUserId,
    deletedByUserName,
    deletedByUserEmail,
    ...recordFields
  } = row

  const createdByUser =
    createdByUserId !== null && createdByUserId !== undefined
      ? {
          id: createdByUserId as string,
          name: createdByUserName as string | undefined,
          email: createdByUserEmail as string | undefined,
        }
      : undefined

  const updatedByUser =
    updatedByUserId !== null && updatedByUserId !== undefined
      ? {
          id: updatedByUserId as string,
          name: updatedByUserName as string | undefined,
          email: updatedByUserEmail as string | undefined,
        }
      : undefined

  const deletedByUser =
    deletedByUserId !== null && deletedByUserId !== undefined
      ? {
          id: deletedByUserId as string,
          name: deletedByUserName as string | undefined,
          email: deletedByUserEmail as string | undefined,
        }
      : undefined

  return {
    ...recordFields,
    ...(createdByUser ? { created_by_user: createdByUser } : {}),
    ...(updatedByUser ? { updated_by_user: updatedByUser } : {}),
    ...(deletedByUser ? { deleted_by_user: deletedByUser } : {}),
  }
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
    readonly and?: readonly FilterNode[]
  }
  readonly sort?: string
}): Effect.Effect<readonly Record<string, unknown>[], DatabaseError> {
  const { tableName, filter, sort } = config
  const onFailure = wrapDatabaseError(`Failed to list trash from ${tableName}`)
  return traceDbQuery(
    'select',
    tableName,
    withTransaction(
      db,
      (tx) =>
        Effect.gen(function* () {
          validateTableName(tableName)

          const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)

          if (!hasDeletedAt) {
            return [] as readonly Record<string, unknown>[]
          }

          const authorshipColumns = yield* checkAuthorshipColumns(tx, tableName)

          const selectFields = buildAuthorshipSelectFields(authorshipColumns)
          const selectClause = sql.raw(selectFields.join(', '))
          const initialQuery = sql`SELECT ${selectClause} FROM ${sql.identifier(tableName)} t`

          const queryWithJoins = buildAuthorshipJoins(initialQuery, authorshipColumns)
          const queryWithWhere = sql`${queryWithJoins} WHERE t.deleted_at IS NOT NULL`
          const queryWithFilters = buildTrashFilters(queryWithWhere, filter?.and)
          const query = addTrashSorting(queryWithFilters, sort)

          const rows = yield* Effect.tryPromise({
            try: () => typedExecute(tx, query),
            catch: onFailure,
          })

          return rows.map(transformRowWithAuthorship)
        }),
      onFailure
    )
  )
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
): Effect.Effect<Record<string, unknown> | null, DatabaseError> {
  const onFailure = wrapDatabaseError(`Failed to get record ${recordId} from ${tableName}`)
  return traceDbQuery(
    'select',
    tableName,
    withTransaction(
      db,
      (tx) =>
        Effect.gen(function* () {
          validateTableName(tableName)

          const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)

          // Build WHERE clause with soft-delete filter if applicable
          const whereClause =
            hasDeletedAt && !includeDeleted
              ? sql` WHERE id = ${recordId} AND deleted_at IS NULL`
              : sql` WHERE id = ${recordId}`

          // Use parameterized query for recordId (automatic via template literal)
          const rows = yield* Effect.tryPromise({
            try: () =>
              typedExecute(
                tx,
                sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause} LIMIT 1`
              ),
            catch: onFailure,
          })

          // eslint-disable-next-line unicorn/no-null -- Null is intentional for database records that don't exist
          return rows[0] ?? null
        }),
      onFailure
    )
  )
}
