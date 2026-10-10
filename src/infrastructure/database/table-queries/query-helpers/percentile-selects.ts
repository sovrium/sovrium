/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import {
  AGGREGATE_PERCENTILES,
  percentileFieldsOf,
  percentOf,
  type AggregatePercentile,
  type PercentileFields,
  type PercentileFigures,
} from '@/domain/models/app/tables/aggregate-percentile-service'
import {
  parseDatabaseDialectConfig,
  type DatabaseDialect,
} from '@/domain/models/process-env/database/database-dialect'
import { validateColumnName } from '../statement/validation'

/**
 * Continuous percentiles, computed by the database, the same figure on both
 * dialects: the non-empty values ranked ascending, interpolated linearly
 * between the values ranked `floor(h)` and `ceil(h)`, `h = (n - 1) × p ÷ 100`
 * — see `aggregate-percentile-service.ts`.
 *
 * PostgreSQL has the ordered-set aggregate: `percentile_cont(p) WITHIN GROUP
 * (ORDER BY …)`, which skips `NULL` and answers `NULL` over no values.
 *
 * SQLite has none, so the relation is first numbered: each percentile field
 * gains its rank among the partition's non-empty values (`ROW_NUMBER` over
 * `ORDER BY v IS NULL, v`, empty values last and so never at a rank below the
 * count) and that count (`COUNT(v)` over the partition). The aggregate then
 * picks the values at the two ranks around `h` with `MAX(CASE …)` and
 * interpolates — a group with no value picks nothing and answers `NULL`. The
 * partition is the grouping's own expressions, so a grouped read ranks each
 * group apart, in the one statement.
 *
 * Every name is a validated column passed through `sql.identifier`; the only
 * literal is the percentage, from the closed list of five.
 */

const currentDialect = (): DatabaseDialect => parseDatabaseDialectConfig().dialect

const rankAlias = (field: string): string => `__sovrium_rank_${field}`
const rankedAlias = (field: string): string => `__sovrium_ranked_${field}`
const figureAlias = (percentile: AggregatePercentile, field: string): string =>
  `${percentile}_${field}`

/**
 * SQLite: `from` (a relation, optionally followed by its `WHERE`) as a derived
 * table carrying each percentile field's rank and count, partitioned by
 * `partitionBy`. Identity on PostgreSQL, or when no percentile is asked.
 */
export function rankForPercentiles(
  from: Readonly<SQL>,
  aggregate: PercentileFields,
  partitionBy: readonly Readonly<SQL>[] = [],
  dialect: DatabaseDialect = currentDialect()
): Readonly<SQL> {
  const fields = percentileFieldsOf(aggregate)
  if (dialect !== 'sqlite' || fields.length === 0) return from
  const partition =
    partitionBy.length === 0 ? sql`` : sql`PARTITION BY ${sql.join([...partitionBy], sql`, `)} `
  const columns = fields.map((field) => {
    validateColumnName(field)
    const column = sql.identifier(field)
    return sql`ROW_NUMBER() OVER (${partition}ORDER BY ${column} IS NULL, ${column}) - 1 AS ${sql.identifier(rankAlias(field))}, COUNT(${column}) OVER (${partition}) AS ${sql.identifier(rankedAlias(field))}`
  })
  return sql`(SELECT *, ${sql.join(columns, sql`, `)} FROM ${from}) AS "__sovrium_ranked"`
}

/** SQLite: the interpolated percentile over a relation {@link rankForPercentiles} numbered. */
const sqliteFigure = (field: string, percent: number): Readonly<SQL> => {
  const value = sql`CAST(${sql.identifier(field)} AS REAL)`
  const rank = sql.identifier(rankAlias(field))
  const ranked = sql.identifier(rankedAlias(field))
  // sql-literal: keyword -- `percent` is one of the five closed-list percentages
  const share = sql.raw(String(percent))
  const h = sql`((${ranked} - 1) * ${share} / 100.0)`
  const low = sql`CAST(${h} AS INTEGER)`
  const high = sql`(${low} + (${h} > ${low}))`
  const lowValue = sql`MAX(CASE WHEN ${rank} = ${low} THEN ${value} END)`
  const highValue = sql`MAX(CASE WHEN ${rank} = ${high} THEN ${value} END)`
  const groupH = sql`((MAX(${ranked}) - 1) * ${share} / 100.0)`
  return sql`(${lowValue} + (${groupH} - CAST(${groupH} AS INTEGER)) * (${highValue} - ${lowValue}))`
}

/** PostgreSQL: the ordered-set aggregate. */
const postgresFigure = (field: string, percent: number): Readonly<SQL> =>
  // sql-literal: keyword -- the fraction comes from the closed list of five percentages
  sql`percentile_cont(${sql.raw(String(percent / 100))}) WITHIN GROUP (ORDER BY CAST(${sql.identifier(field)} AS double precision))`

/**
 * One SELECT item per requested percentile and field, aliased
 * `<percentile>_<field>`. On SQLite they read the columns
 * {@link rankForPercentiles} adds, so the statement must select FROM its output.
 */
export function buildPercentileSelects(
  aggregate: PercentileFields,
  dialect: DatabaseDialect = currentDialect()
): readonly Readonly<SQL>[] {
  return AGGREGATE_PERCENTILES.flatMap((percentile) =>
    (aggregate[percentile] ?? []).map((field) => {
      validateColumnName(field)
      const figure =
        dialect === 'sqlite'
          ? sqliteFigure(field, percentOf(percentile))
          : postgresFigure(field, percentOf(percentile))
      return sql`${figure} AS ${sql.identifier(figureAlias(percentile, field))}`
    })
  )
}

/** The percentiles of a result row, per field: a number, or `null` over no values. */
export function parsePercentileResult(
  row: Readonly<Record<string, unknown>>,
  aggregate: PercentileFields
): PercentileFigures {
  return Object.fromEntries(
    AGGREGATE_PERCENTILES.flatMap((percentile) => {
      const fields = aggregate[percentile] ?? []
      if (fields.length === 0) return []
      const figures = Object.fromEntries(
        fields.flatMap((field) => {
          const raw = row[figureAlias(percentile, field)]
          if (raw === undefined) return []
          const value = raw === null ? null : Number(raw)
          return value === null || Number.isFinite(value) ? [[field, value] as const] : []
        })
      )
      return [[percentile, figures] as const]
    })
  )
}
