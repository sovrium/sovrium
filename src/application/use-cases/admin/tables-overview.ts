/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Build the `/api/admin/tables/overview` response.
 *
 * Combines:
 *  - per-table aggregates from `TablesOverviewRepository`
 *  - a bucketed write-volume time series derived from the same updated_at
 *    timestamps (no separate audit log required for Phase 0 — the engine's
 *    `updated_at` column is the source of truth for "table was written to")
 *
 * ALL database access — the per-table aggregates, the per-table period write
 * counts, and the per-bucket write sums — goes through `TablesOverviewRepository`
 * so this use case carries no raw SQL: the bucketing GRID is decided here while
 * the I/O lives in the repository (the dependency-inversion seam). The handler
 * at `src/presentation/api/routes/admin/tables-overview.ts` provides
 * `app.tables[]` (sanitized table names) and `period`, then runs the returned
 * Effect against the live layer.
 *
 * The grid width is therefore a PRESENTATION choice with no database cost: the
 * repository answers `countWritesPerBucket` with one query per table whatever
 * the bucket count, so asking for 30 points costs exactly what asking for 7
 * does. See the QUERY BUDGET note in
 * `infrastructure/database/repositories/tables/tables-overview-repository-live.ts`.
 */

import { Effect, Semaphore } from 'effect'
import {
  TablesOverviewRepository,
  type TableAggregateRow,
  type TablesOverviewError,
} from '@/application/ports/repositories/tables/tables-overview-repository'
import type { PeriodPreset, SeriesInterval } from '@/domain/models/api/admin/envelope/period-preset'
import type {
  TablesOverviewResponse,
  TableOverviewBreakdownItem,
} from '@/domain/models/api/admin/tables/overview'

/**
 * How many tables-overview roll-ups may run AT ONCE, process-wide.
 *
 * The repository answers every method with one query per configured table at a
 * bounded fan-out (`concurrency: 2`), which caps a SINGLE request's pool usage.
 * That per-request budget is defeated by any concurrency at all: the 2026-07-25
 * production 504 incident logged three admin roll-ups within
 * 8 ms, so N overlapping requests multiply the budget by N and every query
 * queues behind the pool until the whole set lands together on the 30 s
 * `API_TIMEOUT_MS` wall as 504s.
 *
 * A semaphore restores the invariant the budget assumes. Unlike the KPI-tile
 * roll-up in `overview.ts`, this deep-dive page carries NO per-block timeout:
 * this endpoint IS the data view, so a zeroed panel would show an operator
 * wrong numbers rather than a degraded tile. Slow-but-correct is the right
 * trade here; queueing is how we get it.
 *
 * Operator-overridable via `ADMIN_TABLES_OVERVIEW_MAX_CONCURRENT` for
 * deployments that provisioned a larger pool — a deployment concern, so an env
 * var, never the app schema.
 */
const DEFAULT_MAX_CONCURRENT_TABLES_OVERVIEWS = 1
const parseMaxConcurrent = (raw: string | undefined): number => {
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CONCURRENT_TABLES_OVERVIEWS
}
const tablesOverviewSemaphore = Semaphore.makeUnsafe(
  parseMaxConcurrent(process.env.ADMIN_TABLES_OVERVIEW_MAX_CONCURRENT)
)

/** Input for `buildTablesOverview`. */
export interface BuildTablesOverviewInput {
  /** Sanitized table name + display name pairs from the live App config. */
  readonly tables: ReadonlyArray<{ readonly displayName: string; readonly dbName: string }>
  readonly period: PeriodPreset
  /** Reference "now" — exposed for deterministic test fixtures. */
  readonly now: Date
}

/** Period spec — interval, count, and bucket size. */
interface PeriodSpec {
  readonly interval: SeriesInterval
  readonly bucketCount: number
  readonly bucketMs: number
}

/** Period -> (interval, bucket count, bucket size in ms). */
function resolvePeriodSpec(period: PeriodPreset): PeriodSpec {
  if (period === '24h') {
    return { interval: '1h', bucketCount: 24, bucketMs: 60 * 60 * 1000 }
  }
  if (period === '7d') {
    return { interval: '1d', bucketCount: 7, bucketMs: 24 * 60 * 60 * 1000 }
  }
  // 30d
  return { interval: '1d', bucketCount: 30, bucketMs: 24 * 60 * 60 * 1000 }
}

/** Build the per-table breakdown rows in the canonical shape. */
function buildByTable(
  sortedTables: ReadonlyArray<{ readonly displayName: string; readonly dbName: string }>,
  aggregates: ReadonlyArray<TableAggregateRow>,
  perTableWrites: ReadonlyArray<number>
): ReadonlyArray<TableOverviewBreakdownItem> {
  const aggregateByDbName = new Map<string, TableAggregateRow>(
    aggregates.map((row) => [row.tableName, row])
  )
  return sortedTables.map((t, i) => {
    const agg = aggregateByDbName.get(t.dbName)
    return {
      name: t.displayName,
      rowCount: agg?.rowCount ?? 0,
      softDeletedCount: agg?.softDeletedCount ?? 0,
      // eslint-disable-next-line unicorn/no-null -- response contract requires `null`
      lastWriteAt: agg?.lastWriteAt ?? null,
      writesInPeriod: perTableWrites[i] ?? 0,
    }
  })
}

/**
 * The contiguous per-bucket windows of the now-relative series grid: bucket `i`
 * spans `[windowStart + i·bucketMs, windowStart + (i+1)·bucketMs)`. The
 * repository counts writes within each window; the bucket-start timestamp is
 * the series point's label.
 */
function buildBucketWindows(
  windowStart: Readonly<Date>,
  spec: PeriodSpec
): ReadonlyArray<{ readonly start: Date; readonly end: Date }> {
  return Array.from({ length: spec.bucketCount }, (_unused, i) => {
    const start = new Date(windowStart.getTime() + i * spec.bucketMs)
    return { start, end: new Date(start.getTime() + spec.bucketMs) }
  })
}

/**
 * Build the canonical response.
 *
 * Returns an `Effect` requiring `TablesOverviewRepository` (the live layer is
 * provided in the route handler). The series buckets are computed eagerly here
 * because they depend on the period and "now", which are decided per-request;
 * the write counts themselves come from the repository.
 */
export const buildTablesOverview = (
  input: BuildTablesOverviewInput
): Effect.Effect<TablesOverviewResponse, TablesOverviewError, TablesOverviewRepository> =>
  Effect.gen(function* () {
    const repo = yield* TablesOverviewRepository

    // Sort by display name alphabetically — spec asserts contacts < deals etc.
    const sortedTables: ReadonlyArray<{ readonly displayName: string; readonly dbName: string }> =
      // eslint-disable-next-line functional/immutable-data, no-restricted-syntax -- single in-place sort on a freshly-spread copy; never mutates input
      [...input.tables].sort((a, b) => a.displayName.localeCompare(b.displayName))
    const dbNames = sortedTables.map((t) => t.dbName)

    // Per-table aggregates (rowCount, softDeletedCount, lastWriteAt).
    const aggregates = yield* repo.aggregateTables(dbNames)

    // Period window for the per-table `writesInPeriod` count.
    const spec = resolvePeriodSpec(input.period)
    const windowEnd = input.now
    const windowStart = new Date(windowEnd.getTime() - spec.bucketCount * spec.bucketMs)

    const perTableWrites = yield* repo.countWritesPerTable(dbNames, windowStart, windowEnd)
    const byTable = buildByTable(sortedTables, aggregates, perTableWrites)

    // Series: SUM of writes across all tables per bucket. The spec invariant
    // `totals.writes_in_period === sum(series.points[].writes)` holds because
    // both derive from the same per-table `updated_at` counts.
    const buckets = buildBucketWindows(windowStart, spec)
    const bucketWrites = yield* repo.countWritesPerBucket(dbNames, buckets)
    const points = buckets.map((bucket, i) => ({
      timestamp: bucket.start.toISOString(),
      writes: bucketWrites[i] ?? 0,
    }))

    // Totals — derived from by_table to maintain the documented invariants.
    const totals = {
      tables: byTable.length,
      total_rows: byTable.reduce((acc, t) => acc + t.rowCount, 0),
      soft_deleted_rows: byTable.reduce((acc, t) => acc + t.softDeletedCount, 0),
      writes_in_period: byTable.reduce((acc, t) => acc + t.writesInPeriod, 0),
    }

    return {
      totals,
      by_table: [...byTable],
      series: { interval: spec.interval, points: [...points] },
    }
    // Gated process-wide: the repository's bounded per-table fan-out is a
    // PER-REQUEST budget, and only the semaphore makes it a process-wide bound.
  }).pipe(tablesOverviewSemaphore.withPermits(1), Effect.withSpan('admin.build-tables-overview'))
