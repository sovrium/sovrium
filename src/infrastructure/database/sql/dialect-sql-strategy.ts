/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL, type Column, type Name } from 'drizzle-orm'
import { SQLITE_ISO_NOW } from './dialect-ddl'
import { authTableRefOn, systemTableRefOn } from './dialect-sql'
import { bindJsonbOn } from './sql-utils'
import { isInValueSetOn } from './value-set-membership'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/**
 * Time-bucket truncation for time-series aggregation.
 *
 * - Postgres: `DATE_TRUNC('<bucket>', column)::text` — returns a stable text
 *   representation of the truncated timestamp (e.g. `'YYYY-MM-DD 00:00:00+00'`
 *   for day, `'YYYY-MM-DD 14:00:00+00'` for hour).
 * - SQLite: `strftime('<format>', column / 1000, 'unixepoch')` — Sovrium's
 *   SQLite timestamp columns are stored as `integer(mode: 'timestamp_ms')`,
 *   so the epoch-ms value must be divided by 1000 before `strftime` reads it
 *   as `unixepoch`. The format strings are chosen so that two events in the
 *   same bucket produce IDENTICAL text — the `GROUP BY` semantics match
 *   Postgres exactly:
 *     - `hour`  → `'%Y-%m-%d %H:00:00'`
 *     - `day`   → `'%Y-%m-%d'`
 *     - `week`  → `'%Y-W%W'` (week-of-year, ISO-divergent — see note below)
 *     - `month` → `'%Y-%m'`
 *
 * Week-of-year divergence
 * -----------------------
 * Postgres `DATE_TRUNC('week', …)` truncates to ISO 8601 week (Monday-start);
 * SQLite `strftime('%W', …)` uses POSIX week-of-year (Monday-start, but the
 * first week is the first one containing 4 days of the new year). For the
 * granularities Sovrium exposes (`hour | day | week | month`), the only
 * surface that uses `week` is the analytics overview time-series, and Sovrium
 * never compares week buckets across dialects in a single deployment — each
 * deployment runs on exactly one engine. The format is documented here for
 * operators who federate analytics data across dialects.
 *
 * @param column - Drizzle column expression (the timestamp source)
 * @param bucket - Time bucket granularity
 */
const dateTruncTimeBucketOn = (
  dialect: DatabaseDialect,
  column: SQL | Column,
  bucket: 'hour' | 'day' | 'week' | 'month'
): SQL => {
  if (dialect === 'sqlite') {
    // SQLite stores timestamps as INTEGER epoch-ms; divide by 1000 before
    // passing to strftime('…', value, 'unixepoch').
    const format = sqliteBucketFormat(bucket)
    return sql`strftime(${format}, ${column} / 1000, 'unixepoch')`
  }
  // Postgres: bucket is a fixed literal from a closed enum, NEVER user input —
  // safe to inline as a SQL keyword. `::text` casts the timestamp result so
  // GROUP BY equality works across drivers (bun-sql vs node-postgres).
  // sql-literal: keyword -- the bucket is a member of a closed four-value union, never caller text.
  return sql`DATE_TRUNC(${sql.raw(`'${bucket}'`)}, ${column})::text`
}

/**
 * `strftime` format strings for each supported time bucket. The format is the
 * `GROUP BY` key — two events in the same bucket MUST produce identical text.
 */
const sqliteBucketFormat = (bucket: 'hour' | 'day' | 'week' | 'month'): string => {
  if (bucket === 'hour') return '%Y-%m-%d %H:00:00'
  if (bucket === 'day') return '%Y-%m-%d'
  if (bucket === 'week') return '%Y-W%W'
  return '%Y-%m'
}

/**
 * Strict allowlist of JSON property keys Sovrium emits today. Extracting any
 * key outside this list throws — the goal is to prevent a future refactor
 * from accidentally widening the surface to user-controlled keys (which
 * would open a SQL-injection vector via the `'$.${key}'` JSONPath
 * concatenation below).
 *
 * Update this list when a new analytics property is promoted in the
 * `analytics-events.properties` JSON.
 */
const ALLOWED_JSON_KEYS = [
  'path',
  'title',
  'referrerDomain',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'deviceType',
  'browserName',
  'osName',
  // Recorded on every link_click / qr_scan event as the index of the target that
  // served it — the attribution key the per-target split groups on. A literal
  // member of this closed enum like every other entry, so it reaches the
  // JSONPath template no differently.
  'targetIndex',
  // Read by the start-up sweep that finds events still carrying what the
  // `audience-only` analytics profile excludes.
  'referrerUrl',
  'screenWidth',
  'screenHeight',
  'href',
  'pagePath',
  'destination',
  'submissionId',
] as const

/** A JSON property key {@link jsonExtractPath} may read. */
export type AllowedJsonKey = (typeof ALLOWED_JSON_KEYS)[number]

/**
 * Extract a string value from a JSON column at a top-level key.
 *
 * - Postgres: `${jsonColumn}->>'key'` — JSONB string-extraction operator.
 * - SQLite:   `json_extract(${jsonColumn}, '$.key')` — built-in JSON1
 *   function (always enabled in `bun:sqlite`).
 *
 * The two operators produce semantically-identical output for the property
 * shapes Sovrium stores (flat top-level string keys): Postgres returns the
 * underlying string or `NULL`; SQLite returns the string or `NULL`. `GROUP BY`
 * on either expression produces the same buckets.
 *
 * Safety
 * ------
 * `key` is constrained to {@link ALLOWED_JSON_KEYS} — a closed enum of
 * Sovrium-owned property names. The function THROWS for any other key.
 * This is belt-and-suspenders alongside the static type:
 *   1. Static `AllowedJsonKey` rejects typos at compile time.
 *   2. Runtime check rejects dynamically-constructed keys (e.g. from a
 *      future caller that builds the key from `params.field`).
 * Without (2), a refactor could silently introduce SQL injection through
 * the inlined `'$.${key}'` concatenation.
 *
 * @param jsonColumn - The JSON column expression (`properties`, etc.)
 * @param key        - Top-level JSON key (from the allowlist)
 */
const jsonExtractPathOn = (
  dialect: DatabaseDialect,
  jsonColumn: SQL | Column,
  key: AllowedJsonKey
): SQL => {
  // Belt-and-suspenders: enforce the allowlist at runtime even if a caller
  // bypasses the static type via `as AllowedJsonKey`.
  if (!ALLOWED_JSON_KEYS.includes(key)) {
    throw new Error(`jsonExtractPath: key "${key}" is not in the allowlist`)
  }
  if (dialect === 'sqlite') {
    // The JSONPath fragment `'$.<key>'` inlines `key` from a CLOSED enum.
    // No user input ever reaches this template — see ALLOWED_JSON_KEYS.
    // sql-literal: keyword -- the JSONPath key is checked against the closed allowlist above.
    return sql`json_extract(${jsonColumn}, ${sql.raw(`'$.${key}'`)})`
  }
  // sql-literal: keyword -- the key is checked against the closed allowlist above.
  return sql`${jsonColumn}->>${sql.raw(`'${key}'`)}`
}

/**
 * Time interval in the past, relative to "now", for `WHERE <ts_column> >= …`
 * filters.
 *
 * - Postgres: `NOW() - INTERVAL '<amount> <unit>'` — server-side `now()`,
 *   integer-arithmetic interval. Comparison target is a `timestamp` value,
 *   directly comparable with the `timestamp(withTimezone)` column type.
 * - SQLite:   `(strftime('%s','now','-<amount> <unit>s') * 1000)` — emits
 *   an INTEGER epoch-millisecond value, matching Sovrium's
 *   `integer('created_at', { mode: 'timestamp_ms' })` column shape. Using
 *   `datetime('now', …)` would emit a TEXT `'YYYY-MM-DD HH:MM:SS'` value
 *   which compares incorrectly against INTEGER columns.
 *
 * @param amount - Non-negative integer
 * @param unit   - `'year' | 'month' | 'day' | 'hour'`
 */
const dateIntervalAgoOn = (
  dialect: DatabaseDialect,
  amount: number,
  unit: 'year' | 'month' | 'day' | 'hour'
): SQL => {
  // Guard the amount: must be a non-negative integer. `unit` is a closed
  // enum so no runtime check needed beyond the static type.
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`dateIntervalAgo: amount must be a non-negative integer (got ${amount})`)
  }
  if (dialect === 'sqlite') {
    // Emit an INTEGER epoch-ms value (matches Sovrium's
    // `timestamp_ms` column mode). Both `amount` and `unit` are validated,
    // safe to inline as a SQL function-call literal.
    // sql-literal: number -- `amount` is checked to be a non-negative integer and `unit` is a closed union.
    return sql.raw(`(CAST(strftime('%s','now','-${amount} ${unit}s') AS INTEGER) * 1000)`)
  }
  // Postgres: NOW() - INTERVAL '<amount> <unit>' — `amount` and `unit` are
  // both validated, safe to inline as a SQL interval literal.
  // sql-literal: number -- `amount` is checked to be a non-negative integer and `unit` is a closed union.
  return sql.raw(`NOW() - INTERVAL '${amount} ${unit}'`)
}

/**
 * An expression cast to an integer: `(<expr>)::int` on PostgreSQL,
 * `CAST((<expr>) AS INTEGER)` on SQLite. Both drivers then hand back a JS
 * number, so a hand-built aggregate (`COUNT(*)`, `SUM(...)`) reads the same.
 */
const castToIntOn = (dialect: DatabaseDialect, expr: SQL): SQL<number> =>
  dialect === 'sqlite' ? sql<number>`CAST((${expr}) AS INTEGER)` : sql<number>`(${expr})::int`

/**
 * An expression cast to a floating-point number: `(<expr>)::float` on
 * PostgreSQL, `CAST((<expr>) AS REAL)` on SQLite — for a hand-built numeric
 * aggregate (`AVG(...)`, `SUM(...)`).
 */
const castToFloatOn = (dialect: DatabaseDialect, expr: SQL): SQL<number> =>
  dialect === 'sqlite' ? sql<number>`CAST((${expr}) AS REAL)` : sql<number>`(${expr})::float`

/**
 * The SQL fragments whose spelling differs between the two engines, bound to
 * one engine.
 *
 * A caller that holds the `Database` service asks its dialect's strategy to
 * build the fragment instead of asking "am I on SQLite?" and branching itself.
 * Every operation here is the existing helper of the same name, applied to a
 * dialect decided once rather than re-read from the environment per call — the
 * SQL each one emits is unchanged.
 */
export interface DialectSqlStrategy {
  /**
   * "Current timestamp" for a raw `sql` fragment (`NOW()` / ISO-8601 `strftime`).
   * Never SQLite's bare `CURRENT_TIMESTAMP`: it has no `T`, `Z` or milliseconds,
   * so it fails the records API's response validator and sorts before the
   * `created_at` beside it.
   */
  readonly nowExpr: () => SQL
  /** A Better Auth table: `auth.<name>` / `auth_<name>`. */
  readonly authTableRef: (name: string) => SQL
  /** A `system`-namespaced table: `system."<name>"` / `system_<name>`. */
  readonly systemTableRef: (name: string) => SQL
  /** Time-bucket truncation for time-series aggregation. */
  readonly dateTruncTimeBucket: (
    column: SQL | Column,
    bucket: 'hour' | 'day' | 'week' | 'month'
  ) => SQL
  /** A top-level string property of a JSON column, from the closed key allowlist. */
  readonly jsonExtractPath: (jsonColumn: SQL | Column, key: AllowedJsonKey) => SQL
  /** An instant `amount` units before now, for `WHERE <ts> >= …` filters. */
  readonly dateIntervalAgo: (amount: number, unit: 'year' | 'month' | 'day' | 'hour') => SQL
  /** A JS value bound as one JSON parameter, typed `jsonb` on PostgreSQL. */
  readonly bindJsonb: (value: unknown) => SQL
  /** An expression cast to an integer, read back as a JS number on both drivers. */
  readonly castToInt: (expr: SQL) => SQL<number>
  /** An expression cast to a floating-point number, read back as a JS number. */
  readonly castToFloat: (expr: SQL) => SQL<number>
  /** `column IN (<values>)` for a set of any size, bound as one JSON parameter. */
  readonly isInValueSet: (column: SQL | Column | Name, values: readonly string[]) => SQL
}

/** One engine's strategy. */
const strategyOn = (dialect: DatabaseDialect): DialectSqlStrategy =>
  Object.freeze({
    // Same choice as `nowSqlLiteral` in `dialect-ddl.ts` (pinned equal by the strategy test).
    // sql-literal: keyword -- `NOW()` or the fixed `strftime` constant, chosen by the closed dialect union.
    nowExpr: () => sql.raw(dialect === 'sqlite' ? SQLITE_ISO_NOW : 'NOW()'),
    authTableRef: (name: string) => authTableRefOn(dialect, name),
    systemTableRef: (name: string) => systemTableRefOn(dialect, name),
    dateTruncTimeBucket: (column: SQL | Column, bucket: 'hour' | 'day' | 'week' | 'month') =>
      dateTruncTimeBucketOn(dialect, column, bucket),
    jsonExtractPath: (jsonColumn: SQL | Column, key: AllowedJsonKey) =>
      jsonExtractPathOn(dialect, jsonColumn, key),
    dateIntervalAgo: (amount: number, unit: 'year' | 'month' | 'day' | 'hour') =>
      dateIntervalAgoOn(dialect, amount, unit),
    bindJsonb: (value: unknown) => bindJsonbOn(dialect, value),
    castToInt: (expr: SQL) => castToIntOn(dialect, expr),
    castToFloat: (expr: SQL) => castToFloatOn(dialect, expr),
    isInValueSet: (column: SQL | Column | Name, values: readonly string[]) =>
      isInValueSetOn(dialect, column, values),
  })

const POSTGRES_STRATEGY = strategyOn('postgres')
const SQLITE_STRATEGY = strategyOn('sqlite')

/** The strategy for one engine. Two frozen objects, shared by every caller. */
export const dialectSqlStrategyFor = (dialect: DatabaseDialect): DialectSqlStrategy =>
  dialect === 'sqlite' ? SQLITE_STRATEGY : POSTGRES_STRATEGY
