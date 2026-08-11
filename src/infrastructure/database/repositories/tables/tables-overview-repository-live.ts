/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live implementation of `TablesOverviewRepository`.
 *
 * QUERY BUDGET — the invariant this file is written around
 * --------------------------------------------------------
 * Every method answers with **at most one query per configured table**, so the
 * per-request cost is `O(tables)` and NEVER `O(tables × buckets)`.
 *
 * That bound is not a micro-optimization; it is the fix for a production 504
 * incident (2026-07-25). The previous shape issued
 * `4·tables + buckets·tables` queries — on a 10-table deployment that
 * was 108 at `?period=7d`, 278 at `24h`, and 338 at `30d`. `buckets` is a display
 * choice made per request from a query-string preset, so a wider chart silently
 * widened the DATABASE fan-out. Peak parallelism reached the ENTIRE
 * `DEFAULT_DATABASE_POOL_MAX` (10), so one in-flight overview starved every
 * co-firing request — including the admin auth middleware's own session lookup —
 * until all of them hit `API_TIMEOUT_MS` and returned 504 together.
 *
 * Two mechanisms hold the budget, and BOTH are required:
 *
 *  1. **Conditional aggregation** — the three per-table aggregates collapse into
 *     one `SELECT`, and the whole bucket grid collapses into one `SELECT` whose
 *     column list carries one `SUM(CASE WHEN …)` per bucket. Deliberately NOT a
 *     `GROUP BY` over a computed bucket index: that needs date arithmetic, which
 *     is dialect-divergent (`EXTRACT(EPOCH …)` on PostgreSQL vs
 *     `strftime('%s', …)` on SQLite). `CASE WHEN` is ANSI and behaves identically
 *     on both engines.
 *  2. **Bounded fan-out** — every per-table fan-out runs through
 *     `Effect.all(..., { concurrency: 2 })` (the DB-bound precedent in
 *     `infrastructure/database/views/view-generators.ts`), never a raw
 *     `Promise.all`. Reducing the query COUNT alone would not cap pool usage; the
 *     concurrency ceiling is what does.
 *
 * DEGRADATION: each per-table read is individually wrapped in a `try/catch` that
 * resolves to zeros (and `lastWriteAt: null`). A table the engine has not created
 * yet — a recently-configured app booted before its DDL ran — contributes zeros
 * instead of failing the whole roll-up.
 *
 * DIALECT NOTE: every raw read below goes through `executeRawTyped`, NOT
 * `db.execute()`. `execute()` is a PostgreSQL-client method — the SQLite client
 * (`drizzle-orm/bun-sqlite`) has no `.execute()`, only `.run()`/`.all()`/`.get()`.
 * Because each read is wrapped in a `catch → 0` guard, calling `db.execute()`
 * under SQLite did not surface an error: it threw `TypeError: not a function`,
 * the guard swallowed it, and EVERY table silently contributed 0. The
 * `records.total` tile therefore read "0 records" against a full database on the
 * zero-config default engine — i.e. on every fresh self-hosted install.
 */

import { sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  TablesOverviewError,
  TablesOverviewRepository,
  type TableAggregateRow,
} from '@/application/ports/repositories/tables/tables-overview-repository'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { db } from '@/infrastructure/database'
import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'

/**
 * Width of every per-table fan-out in this file.
 *
 * Matches the DB-bound precedent in
 * `infrastructure/database/views/view-generators.ts`. Two concurrent statements
 * leave eight of the ten default pool slots for the rest of the process, which
 * is what keeps a single overview request from starving the admin auth
 * middleware's session lookup — the 2026-07-25 incident above.
 */
const TABLE_FANOUT_CONCURRENCY = 2

/** One bucket of the now-relative series grid, half-open as `[start, end)`. */
interface BucketWindow {
  readonly start: Readonly<Date>
  readonly end: Readonly<Date>
}

/** Row shape returned by the collapsed per-table aggregate query. */
interface AggregateQueryRow {
  readonly live_count: number | string | null
  readonly soft_deleted_count: number | string | null
  readonly last_write: Readonly<Date> | string | null | undefined
}

/** Zeroed aggregate for a table that could not be read (missing / dialect error). */
const zeroedAggregate = (tableName: string): TableAggregateRow => ({
  tableName,
  rowCount: 0,
  softDeletedCount: 0,
  // eslint-disable-next-line unicorn/no-null -- response contract requires `null`, not `undefined`
  lastWriteAt: null,
})

/**
 * Normalize a possibly-non-ISO timestamp string to ISO 8601 UTC with `Z`.
 *
 * SQLite returns `YYYY-MM-DD HH:MM:SS` (space separator, no `Z`); Postgres
 * returns ISO 8601 already. We pipe both through `new Date(...).toISOString()`
 * for a canonical UTC form.
 */
function normalizeIsoTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    // Last-ditch: append `Z` and hope. The schema parse will catch bad strings.
    return value.endsWith('Z') ? value : `${value}Z`
  }
  return parsed.toISOString()
}

/**
 * Coerce a driver-returned `MAX(updated_at)` into the response contract's
 * `string | null`. PostgreSQL hands back a `Date`; SQLite hands back ISO-8601
 * text; an empty table hands back `NULL` on both.
 */
function normalizeLastWrite(raw: Readonly<Date> | string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    // eslint-disable-next-line unicorn/no-null -- response contract requires `null`, not `undefined`
    return null
  }
  return raw instanceof Date ? raw.toISOString() : normalizeIsoTimestamp(String(raw))
}

/**
 * Run one table's three aggregates in a SINGLE query.
 *
 * `SUM(CASE WHEN …)` splits the live and soft-deleted counts over one scan
 * instead of two `COUNT(*)` passes, and `MAX(updated_at)` rides along in the
 * same projection. `MAX(updated_at)` is sufficient for "last write" because
 * every engine-created table updates `updated_at` on
 * insert/update/soft-delete/restore, and the column is dialect-portable
 * (SQLite has no `GREATEST`).
 *
 * An empty table yields `NULL` for all three columns; `toFiniteCount` maps the
 * two sums to `0` and `normalizeLastWrite` maps the timestamp to `null`.
 *
 * Returns zeros + `null` for tables that do not exist (engine has not yet
 * created the table, or the table was removed at config time).
 */
async function aggregateOneTable(tableName: string): Promise<TableAggregateRow> {
  try {
    const rows = await executeRawTyped<AggregateQueryRow>(
      db,
      sql`SELECT SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) AS live_count, SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS soft_deleted_count, MAX(updated_at) AS last_write FROM ${sql.identifier(tableName)}`
    )
    const row = rows[0]
    return {
      tableName,
      rowCount: toFiniteCount(row?.live_count),
      softDeletedCount: toFiniteCount(row?.soft_deleted_count),
      lastWriteAt: normalizeLastWrite(row?.last_write),
    }
  } catch {
    // Missing table / dialect mismatch / engine-error: treat as zeroed-out.
    return zeroedAggregate(tableName)
  }
}

/**
 * Live row count for one table (`COUNT(*) WHERE deleted_at IS NULL`) — the lean
 * single-scalar path used by the cross-domain roll-up. Wrapped in its own
 * per-table try/catch → 0 so a missing table (not yet created / removed at
 * config time) or a dialect error contributes 0 instead of failing the whole
 * roll-up. The outer `Effect.tryPromise` catch is a type-level backstop only —
 * the inner catch already resolves every failure to 0.
 */
const countLiveRowsOne = (tableName: string): Effect.Effect<number, TablesOverviewError> =>
  Effect.tryPromise({
    try: async () => {
      try {
        const result = await executeRawTyped<{ readonly count: number | string }>(
          db,
          sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE deleted_at IS NULL`
        )
        return toFiniteCount(result[0]?.count)
      } catch {
        return 0
      }
    },
    catch: (cause) => new TablesOverviewError({ cause }),
  })

/**
 * Count rows of one table whose `updated_at` falls within `[start, end)`.
 *
 * Returns 0 for missing tables / dialect errors so a single misconfigured
 * table never fails the whole overview. Uses `sql.identifier()` for the
 * validated table name and parameter binding for the window bounds (S3).
 */
async function countWritesInWindow(
  tableName: string,
  start: Readonly<Date>,
  end: Readonly<Date>
): Promise<number> {
  try {
    const result = await executeRawTyped<{ readonly count: number | string }>(
      db,
      sql`SELECT COUNT(*) AS count FROM ${sql.identifier(tableName)} WHERE updated_at >= ${start.toISOString()} AND updated_at < ${end.toISOString()}`
    )
    return toFiniteCount(result[0]?.count)
  } catch {
    return 0
  }
}

/** Result-column alias for bucket `index` in the collapsed bucket query. */
const bucketAlias = (index: number): string => `bucket_${index}`

/**
 * Count writes for EVERY bucket of one table in a SINGLE query.
 *
 * The projection carries one `SUM(CASE WHEN updated_at >= ? AND updated_at < ?
 * THEN 1 ELSE 0 END)` per bucket, so a 30-point grid costs the same one
 * statement as a 7-point grid. The half-open `[start, end)` predicate is
 * character-for-character the one `countWritesInWindow` uses, which is what
 * keeps `totals.writes_in_period === sum(series.points[].writes)` exact.
 *
 * The outer `WHERE` narrows the scan to the union of the bucket windows. It is
 * derived from the buckets themselves (min start / max end) rather than assumed
 * contiguous, so it can only ever be a SUPERSET of what the `CASE` arms match —
 * never a filter that could drop a counted row.
 *
 * S3: `sql.identifier()` for the validated table name and for every generated
 * column alias; parameter binding for every date bound. Nothing is interpolated.
 */
async function countWritesPerBucketOneTable(
  tableName: string,
  buckets: ReadonlyArray<BucketWindow>
): Promise<ReadonlyArray<number>> {
  const zeros = buckets.map(() => 0)
  try {
    const bucketColumns = buckets.map(
      (bucket, index) =>
        sql`SUM(CASE WHEN updated_at >= ${bucket.start.toISOString()} AND updated_at < ${bucket.end.toISOString()} THEN 1 ELSE 0 END) AS ${sql.identifier(bucketAlias(index))}`
    )
    const windowStart = new Date(
      buckets.reduce((min, b) => Math.min(min, b.start.getTime()), Number.POSITIVE_INFINITY)
    )
    const windowEnd = new Date(
      buckets.reduce((max, b) => Math.max(max, b.end.getTime()), Number.NEGATIVE_INFINITY)
    )

    const rows = await executeRawTyped(
      db,
      sql`SELECT ${sql.join(bucketColumns, sql.raw(', '))} FROM ${sql.identifier(tableName)} WHERE updated_at >= ${windowStart.toISOString()} AND updated_at < ${windowEnd.toISOString()}`
    )
    const row = rows[0]
    return buckets.map((_bucket, index) => toFiniteCount(row?.[bucketAlias(index)]))
  } catch {
    return zeros
  }
}

/**
 * Live layer providing the tables-overview repository.
 *
 * Every method fans out over `tableNames` at `TABLE_FANOUT_CONCURRENCY`, and
 * every table costs exactly one query — see the QUERY BUDGET note at the top of
 * this file for why both halves of that sentence are load-bearing.
 */
export const TablesOverviewRepositoryLive = Layer.succeed(TablesOverviewRepository, {
  aggregateTables: (tableNames) =>
    Effect.all(
      tableNames.map((name) =>
        Effect.tryPromise({
          try: () => aggregateOneTable(name),
          catch: (cause) => new TablesOverviewError({ cause }),
        })
      ),
      { concurrency: TABLE_FANOUT_CONCURRENCY }
    ),

  countLiveRows: (tableNames) =>
    Effect.all(tableNames.map(countLiveRowsOne), { concurrency: TABLE_FANOUT_CONCURRENCY }),

  countWritesPerTable: (tableNames, windowStart, windowEnd) =>
    Effect.all(
      tableNames.map((name) =>
        Effect.tryPromise({
          try: () => countWritesInWindow(name, windowStart, windowEnd),
          catch: (cause) => new TablesOverviewError({ cause }),
        })
      ),
      { concurrency: TABLE_FANOUT_CONCURRENCY }
    ),

  countWritesPerBucket: (tableNames, buckets) =>
    buckets.length === 0
      ? Effect.succeed([])
      : Effect.all(
          tableNames.map((name) =>
            Effect.tryPromise({
              try: () => countWritesPerBucketOneTable(name, buckets),
              catch: (cause) => new TablesOverviewError({ cause }),
            })
          ),
          { concurrency: TABLE_FANOUT_CONCURRENCY }
        ).pipe(
          // Transpose: one row per table, each holding one count per bucket →
          // one summed count per bucket, in bucket order (the port's contract).
          Effect.map((perTable) =>
            buckets.map((_bucket, index) =>
              perTable.reduce((sum, counts) => sum + (counts[index] ?? 0), 0)
            )
          )
        ),
})
