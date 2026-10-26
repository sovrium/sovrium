/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database'
import { retryOnceOnStaleColumns } from '@/infrastructure/database/sql/catalog-request-cache'
import { passingFilterRefusal } from '@/infrastructure/database/sql/db-effect'
import { traceDbQuery } from '@/infrastructure/telemetry/db-query-trace'
import {
  buildAggregationSelects,
  parseAggregationResult,
  buildPageClause,
  buildSelectListClause,
  checkDeletedAtColumn as checkDeletedAtColumnHelper,
  checkAuthorshipColumns,
  type FilterNode,
} from '../query-helpers/aggregation-helpers'
import { whereClauseOf } from '../query-helpers/filter-clause-effect'
import { maskedRelation, type LookupReadMaskSpec } from '../query-helpers/lookup-read-mask'
import {
  buildOrderByClause,
  defaultOrderKeys,
  type OrderByAppView,
  type OrderByPrimaryKey,
} from '../query-helpers/order-by-helpers'
import {
  buildPercentileSelects,
  parsePercentileResult,
  rankForPercentiles,
} from '../query-helpers/percentile-selects'
import { buildTrashFilters, addTrashSorting } from '../query-helpers/trash-helpers'
import { wordSearchRelevance } from '../query-helpers/word-search-fragments'
import { wrapDatabaseError } from '../statement/error-handling'
import { typedExecute } from '../statement/typed-execute'
import { tableIdentifier } from '../statement/validation'
import {
  buildAuthorshipJoins,
  buildAuthorshipSelectFields,
  transformRowWithAuthorship,
} from './crud-authorship'
import type { TableReadError } from '@/application/ports/repositories/tables/table-repository'
import type {
  PercentileFields,
  PercentileFigures,
} from '@/domain/models/app/tables/aggregate-percentile-service'
import type { CaseFoldedSortField } from '@/domain/models/app/tables/text-sort-service'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { DatabaseError } from '@/infrastructure/database'
import type { SQL } from 'drizzle-orm'

/**
 * A one-statement read, traced as a `select`, retried once when the database
 * refuses a column a cached catalog answer named ({@link retryOnceOnStaleColumns}).
 */
const tracedRead = <A, E>(tableName: string, read: Effect.Effect<A, E>): Effect.Effect<A, E> =>
  traceDbQuery('select', tableName, retryOnceOnStaleColumns(read))

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
/**
 * How a list is ordered. An unsorted word search (`?q=` on a `fullTextSearch`
 * field) comes back most relevant first; an explicit sort replaces relevance,
 * and folds the case of the text fields it names.
 */
const listOrdering = (config: {
  readonly tableName: string
  readonly filter?: { readonly and?: readonly FilterNode[] }
  readonly sort?: string
  readonly app?: OrderByAppView
  readonly primaryKey?: OrderByPrimaryKey
  readonly caseFoldedSortFields?: readonly CaseFoldedSortField[]
}): { readonly prefix: Readonly<SQL>; readonly orderBy: Readonly<SQL> } => {
  const { sort, primaryKey } = config
  const relevance =
    sort === undefined
      ? wordSearchRelevance(config.filter, defaultOrderKeys(primaryKey))
      : undefined
  return {
    prefix: relevance?.prefix ?? sql``,
    orderBy:
      relevance?.orderBy ??
      buildOrderByClause(sort, config.app, config.tableName, {
        primaryKey,
        caseFolded: config.caseFoldedSortFields,
      }),
  }
}

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
  /** Lookups evaluated as empty where the reader may not read the linked row. */
  readonly lookupMasks?: readonly LookupReadMaskSpec[]
  readonly app?: OrderByAppView
  /**
   * The table's declared primary key. Consulted ONLY to pick the default sort
   * key for a request that supplied no `sort` — a table keyed on a composite of
   * its own columns has no `id` column to order by. See `buildOrderByClause`.
   */
  readonly primaryKey?: OrderByPrimaryKey
  /** The text columns a sort compares ignoring case. */
  readonly caseFoldedSortFields?: readonly CaseFoldedSortField[]
}): Effect.Effect<readonly Record<string, unknown>[], TableReadError> {
  const { tableName, filter, includeDeleted, limit, offset, columns } = config
  const { lookupMasks } = config
  const onFailure = wrapDatabaseError(`Failed to list records from ${tableName}`)
  return tracedRead(
    tableName,
    Effect.gen(function* () {
      // Every clause is built BEFORE the read runs, and the read is one
      // SELECT, so it opens no transaction: no connection waits on the event
      // loop between BEGIN and COMMIT. The catalog answers below come from
      // the per-process column cache after the first read of the table.
      const hasDeletedAt = yield* checkDeletedAtColumnHelper(db, tableName)
      const whereClause = yield* whereClauseOf(tableName, hasDeletedAt, includeDeleted, filter)
      const ordering = listOrdering(config)
      // Empty when the caller passes neither `limit` nor `offset`, which is
      // every pre-pagination call site — the statement below is unchanged
      // for them, down to the byte.
      const pageClause = buildPageClause(limit, offset)
      // `*` unless the caller projected. `ORDER BY` deliberately runs
      // against the FULL relation rather than the projected list: a plain
      // non-DISTINCT select may order by a column it does not return, on
      // both dialects, so a sort key never has to be force-projected.
      const selectList = yield* buildSelectListClause(db, tableName, columns)
      const relation = yield* maskedRelation(db, tableName, lookupMasks)

      return yield* Effect.tryPromise({
        try: () =>
          typedExecute(
            db,
            sql`${ordering.prefix}SELECT ${selectList} FROM ${relation}${whereClause}${ordering.orderBy}${pageClause}`
          ),
        catch: onFailure,
      })
    })
  )
}

/** The aggregate spec a caller asks for, named once so the query below can be extracted. */
type AggregationSpec = PercentileFields & {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

/** What {@link computeAggregations} resolves to; `null` is an aggregate over no values. */
type AggregationResult = PercentileFigures & {
  readonly count?: string
  readonly sum?: Record<string, number | null>
  readonly avg?: Record<string, number | null>
  readonly min?: Record<string, number | string | null>
  readonly max?: Record<string, number | string | null>
}

/**
 * The aggregation SELECT: one statement, run without a transaction once every
 * clause is built.
 *
 * Extracted from {@link computeAggregations} only so that function stays inside
 * the size limit — its inline result type is most of its length.
 */
const runAggregations = (
  params: {
    readonly tableName: string
    readonly filter?: { readonly and?: readonly FilterNode[] }
    readonly includeDeleted?: boolean
    readonly aggregate: AggregationSpec
    readonly lookupMasks?: readonly LookupReadMaskSpec[]
  },
  onFailure: (error: unknown) => DatabaseError
): Effect.Effect<AggregationResult, TableReadError> =>
  Effect.gen(function* () {
    const { tableName, filter, includeDeleted, aggregate, lookupMasks } = params
    const hasDeletedAt = yield* checkDeletedAtColumnHelper(db, tableName)
    const whereClause = yield* whereClauseOf(tableName, hasDeletedAt, includeDeleted, filter)
    const aggregationSelects = buildAggregationSelects(aggregate)
    const percentileSelects = buildPercentileSelects(aggregate)
    if (aggregationSelects.length + percentileSelects.length === 0) return {}

    const selectClause = sql.join(
      [
        // sql-literal: identifier -- aggregate columns pass validateColumnName
        ...(aggregationSelects.length > 0 ? [sql.raw(aggregationSelects.join(', '))] : []),
        ...percentileSelects,
      ],
      sql`, `
    )
    const relation = yield* maskedRelation(db, tableName, lookupMasks)
    // SQLite ranks each percentile field first; the source is unchanged otherwise.
    const source = rankForPercentiles(sql`${relation}${whereClause}`, aggregate)
    const rows = yield* Effect.tryPromise({
      try: () => typedExecute(db, sql`SELECT ${selectClause} FROM ${source}`),
      catch: onFailure,
    })
    if (rows.length === 0) return {}

    return {
      ...parseAggregationResult(rows[0]!, aggregate),
      ...parsePercentileResult(rows[0]!, aggregate),
    }
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
  readonly lookupMasks?: readonly LookupReadMaskSpec[]
}): Effect.Effect<AggregationResult, TableReadError> {
  const { tableName, filter, includeDeleted, aggregate, lookupMasks } = config
  const onFailure = wrapDatabaseError(`Failed to compute aggregations from ${tableName}`)
  return tracedRead(
    tableName,
    runAggregations({ tableName, filter, includeDeleted, aggregate, lookupMasks }, onFailure)
  )
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
  readonly lookupMasks?: readonly LookupReadMaskSpec[]
  readonly sort?: string
}): Effect.Effect<readonly Record<string, unknown>[], TableReadError> {
  const { tableName, filter, sort, lookupMasks } = config
  const onFailure = wrapDatabaseError(`Failed to list trash from ${tableName}`)
  return tracedRead(
    tableName,
    Effect.gen(function* () {
      const hasDeletedAt = yield* checkDeletedAtColumnHelper(db, tableName)

      if (!hasDeletedAt) {
        return [] as readonly Record<string, unknown>[]
      }

      const authorshipColumns = yield* checkAuthorshipColumns(db, tableName)

      const selectFields = buildAuthorshipSelectFields(authorshipColumns)
      // sql-literal: identifier -- fixed authorship column list
      const selectClause = sql.raw(selectFields.join(', '))
      // A lookup the reader may not read is evaluated as empty wherever the
      // filter or the sort names it, as the live list does.
      const relation = yield* maskedRelation(db, tableName, lookupMasks, 't')
      const initialQuery = sql`SELECT ${selectClause} FROM ${relation}`

      const queryWithJoins = buildAuthorshipJoins(initialQuery, authorshipColumns)
      const queryWithWhere = sql`${queryWithJoins} WHERE t.deleted_at IS NOT NULL`
      const queryWithFilters = yield* Effect.try({
        try: () => buildTrashFilters(queryWithWhere, filter?.and),
        catch: passingFilterRefusal(onFailure),
      })
      const query = addTrashSorting(queryWithFilters, sort)

      const rows = yield* Effect.tryPromise({
        try: () => typedExecute(db, query),
        catch: onFailure,
      })

      return rows.map(transformRowWithAuthorship)
    })
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
  return tracedRead(
    tableName,
    Effect.gen(function* () {
      const hasDeletedAt = yield* checkDeletedAtColumnHelper(db, tableName)

      // Build WHERE clause with soft-delete filter if applicable
      const whereClause =
        hasDeletedAt && !includeDeleted
          ? sql` WHERE id = ${recordId} AND deleted_at IS NULL`
          : sql` WHERE id = ${recordId}`

      // Use parameterized query for recordId (automatic via template literal)
      const rows = yield* Effect.tryPromise({
        try: () =>
          typedExecute(db, sql`SELECT * FROM ${tableIdentifier(tableName)}${whereClause} LIMIT 1`),
        catch: onFailure,
      })

      return rows[0] ?? null
    })
  )
}
