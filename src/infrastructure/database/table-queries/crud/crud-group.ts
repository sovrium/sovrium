/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import { withTransaction } from '@/infrastructure/database/transaction'
import { traceDbQuery } from '@/infrastructure/telemetry/db-query-trace'
import {
  buildAggregationSelects,
  buildWhereClause,
  checkDeletedAtColumn,
  parseAggregationResult,
  type FilterNode,
} from '../query-helpers/aggregation-helpers'
import { maskedRelation, type LookupReadMaskSpec } from '../query-helpers/lookup-read-mask'
import {
  buildOrderByClause,
  type OrderByAppView,
  type OrderByPrimaryKey,
} from '../query-helpers/order-by-helpers'
import { wrapDatabaseError } from '../statement/error-handling'
import { typedExecute } from '../statement/typed-execute'
import { validateColumnName } from '../statement/validation'
import type { DatabaseError, DrizzleTransaction } from '@/infrastructure/database'

/**
 * Grouped figures computed by the database — one `GROUP BY` per grouping level.
 *
 * This is what keeps a grouped listing and an aggregate read from growing with
 * the table. Partitioning in the process would bring every matching row into
 * memory; here the database answers one row per GROUP, so the
 * rows read are bounded by the number of distinct values, not by the table.
 */

/** A calendar bucket a date column can be grouped by. */
export type GroupInterval = 'day' | 'week' | 'month' | 'quarter' | 'year'

/** One grouping level: a column, optionally bucketed by calendar interval. */
export interface GroupLevelSpec {
  readonly field: string
  readonly interval?: GroupInterval
}

/** The aggregate spec a caller asks for, in the list endpoint's shape. */
type AggregationSpec = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

/** One group as the database answered it. */
export interface GroupedAggregationRow {
  /** One raw driver value per level, outermost first. */
  readonly values: readonly unknown[]
  readonly count: number
  /** Figures of the group, parsed as the whole-list aggregation parses them. */
  readonly aggregations: ReturnType<typeof parseAggregationResult>
  /** Per averaged field, how many of the group's rows carried a value. */
  readonly valued: Readonly<Record<string, number>>
}

/** How the groups are ordered: in the order the list's sort first meets them, or by value. */
export type GroupOrder =
  | {
      readonly kind: 'first-seen'
      readonly sort?: string
      readonly app?: OrderByAppView
      readonly primaryKey?: OrderByPrimaryKey
    }
  | { readonly kind: 'by-value' }

export interface GroupedAggregationConfig {
  readonly tableName: string
  readonly filter?: { readonly and?: readonly FilterNode[] }
  readonly includeDeleted?: boolean
  readonly lookupMasks?: readonly LookupReadMaskSpec[]
  /** Grouping levels, outermost first. One statement per prefix of this list. */
  readonly levels: readonly GroupLevelSpec[]
  readonly aggregate: AggregationSpec
  readonly order: GroupOrder
  /**
   * Stop reading past this many groups per level. The read asks for one more,
   * so a caller can tell "exactly the cap" from "over it" without a count.
   */
  readonly maxGroups?: number
}

const ROW_NUMBER = '__sovrium_rn'
const GROUP_COUNT = '__sovrium_group_count'
const groupAlias = (index: number): string => `__sovrium_g${String(index)}`
const valuedAlias = (field: string): string => `__sovrium_valued_${field}`

const INTERVALS: ReadonlySet<GroupInterval> = new Set(['day', 'week', 'month', 'quarter', 'year'])

/**
 * PostgreSQL: the bucket's first day, as ISO date text. The unit is spliced as
 * a literal — it comes from the closed list above, checked here — because a
 * bound parameter leaves `date_trunc`'s overload to be guessed.
 */
const pgBucket = (column: Readonly<SQL>, interval: GroupInterval): Readonly<SQL> => {
  const unit = INTERVALS.has(interval) ? interval : 'day'
  // sql-literal: keyword -- `unit` is checked against the closed INTERVALS list above
  return sql`to_char(date_trunc(${sql.raw(`'${unit}'`)}, ${column}), 'YYYY-MM-DD')`
}

/** SQLite: the bucket's first day, as ISO date text (a week starts on Monday, as on PostgreSQL). */
const sqliteBucket = (column: Readonly<SQL>, interval: GroupInterval): Readonly<SQL> => {
  if (interval === 'day') return sql`date(${column})`
  if (interval === 'month') return sql`strftime('%Y-%m-01', ${column})`
  if (interval === 'year') return sql`strftime('%Y-01-01', ${column})`
  if (interval === 'week') {
    return sql`date(${column}, '-' || ((CAST(strftime('%w', ${column}) AS INTEGER) + 6) % 7) || ' days')`
  }
  return sql`printf('%s-%02d-01', strftime('%Y', ${column}), ((CAST(strftime('%m', ${column}) AS INTEGER) - 1) / 3) * 3 + 1)`
}

/** The expression a level groups on: the column itself, or its calendar bucket. */
const levelExpression = (level: GroupLevelSpec): Readonly<SQL> => {
  validateColumnName(level.field)
  const column = sql`${sql.identifier(level.field)}`
  if (level.interval === undefined) return column
  return parseDatabaseDialectConfig().dialect === 'sqlite'
    ? sqliteBucket(column, level.interval)
    : pgBucket(column, level.interval)
}

/** Non-null counts beside each average, so two partial groups can be merged into one true average. */
const valuedSelects = (aggregate: AggregationSpec): readonly string[] =>
  (aggregate.avg ?? []).map((field) => {
    validateColumnName(field)
    return `COUNT("${field}") AS ${valuedAlias(field)}`
  })

/** The `GROUP BY` statement of one depth: the first `depth` levels. */
const groupStatement = (
  source: Readonly<SQL>,
  config: GroupedAggregationConfig,
  depth: number
): Readonly<SQL> => {
  const expressions = config.levels.slice(0, depth).map(levelExpression)
  const keys = sql.join(
    expressions.map(
      (expression, index) => sql`${expression} AS ${sql.identifier(groupAlias(index))}`
    ),
    sql`, `
  )
  // sql-literal: identifier -- aggregate columns pass validateColumnName; aliases are constants
  const figures = sql.raw(
    [
      `COUNT(*) AS ${GROUP_COUNT}`,
      ...buildAggregationSelects(config.aggregate),
      ...valuedSelects(config.aggregate),
    ].join(', ')
  )
  const orderBy =
    config.order.kind === 'first-seen'
      ? // sql-literal: identifier -- ROW_NUMBER is a module constant
        sql.raw(` ORDER BY MIN("${ROW_NUMBER}")`)
      : // sql-literal: identifier -- group aliases are generated, not caller text
        sql.raw(
          ` ORDER BY ${expressions.map((_, index) => `"${groupAlias(index)}" ASC NULLS LAST`).join(', ')}`
        )
  const limit = config.maxGroups === undefined ? sql`` : sql` LIMIT ${config.maxGroups + 1}`
  return sql`SELECT ${keys}, ${figures} FROM ${source} GROUP BY ${sql.join(expressions, sql`, `)}${orderBy}${limit}`
}

/** The filtered relation every depth groups — numbered in list order when groups keep first-seen order. */
const groupSource = (
  relation: Readonly<SQL>,
  whereClause: Readonly<SQL>,
  config: GroupedAggregationConfig
): Readonly<SQL> => {
  if (config.order.kind !== 'first-seen') {
    return sql`(SELECT * FROM ${relation}${whereClause}) AS "__sovrium_grouped"`
  }
  const { sort, app, primaryKey } = config.order
  const orderBy = buildOrderByClause(sort, app, config.tableName, primaryKey)
  // sql-literal: identifier -- ROW_NUMBER is a module constant
  return sql`(SELECT *, ROW_NUMBER() OVER (${orderBy}) AS "${sql.raw(ROW_NUMBER)}" FROM ${relation}${whereClause}) AS "__sovrium_grouped"`
}

/** One database row of a depth, read back into a {@link GroupedAggregationRow}. */
const toGroupRow = (
  row: Readonly<Record<string, unknown>>,
  depth: number,
  aggregate: AggregationSpec
): GroupedAggregationRow => ({
  values: Array.from({ length: depth }, (_, index) => row[groupAlias(index)]),
  count: Number(row[GROUP_COUNT]),
  aggregations: parseAggregationResult(row, aggregate),
  valued: Object.fromEntries(
    (aggregate.avg ?? []).map((field) => [field, Number(row[valuedAlias(field)])])
  ),
})

const runGroupsInTx = (
  tx: Readonly<DrizzleTransaction>,
  config: GroupedAggregationConfig,
  onFailure: (error: unknown) => DatabaseError
): Effect.Effect<readonly (readonly GroupedAggregationRow[])[], DatabaseError> =>
  Effect.gen(function* () {
    const hasDeletedAt = yield* checkDeletedAtColumn(tx, config.tableName)
    const whereClause = buildWhereClause(hasDeletedAt, config.includeDeleted, config.filter)
    const relation = yield* maskedRelation(tx, config.tableName, config.lookupMasks)
    const source = groupSource(relation, whereClause, config)
    return yield* Effect.forEach(
      config.levels.map((_, index) => index + 1),
      (depth) =>
        Effect.tryPromise({
          try: () => typedExecute(tx, groupStatement(source, config, depth)),
          catch: onFailure,
        }).pipe(Effect.map((rows) => rows.map((row) => toGroupRow(row, depth, config.aggregate))))
    )
  })

/**
 * Compute every group of every depth of a grouping, in the database.
 *
 * Returns one array per depth (the outermost level alone, then the first two
 * levels, …), each holding one row per distinct value combination. All depths
 * run in one transaction, against the same filter and soft-delete clause the
 * listing and the total use, so the groups describe exactly the rows the page
 * and `pagination.total` describe.
 */
export function computeGroupedAggregations(
  config: GroupedAggregationConfig
): Effect.Effect<readonly (readonly GroupedAggregationRow[])[], DatabaseError> {
  const onFailure = wrapDatabaseError(`Failed to group records of ${config.tableName}`)
  return traceDbQuery(
    'select',
    config.tableName,
    withTransaction(db, (tx) => runGroupsInTx(tx, config, onFailure), onFailure)
  )
}
