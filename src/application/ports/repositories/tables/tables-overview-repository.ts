/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Tables-Overview Repository Port.
 *
 * Backs `GET /api/admin/tables/overview`. Returns per-table aggregates
 * (live row count, soft-deleted row count, last-write timestamp) used by
 * the operator dashboard.
 *
 * The port is intentionally tables-overview specific — it groups three
 * related aggregates that are always computed together for the same table,
 * letting the implementation issue ONE query per metric for a list of
 * tables instead of N queries per N tables.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/** Per-table aggregate row produced by the repository. */
export interface TableAggregateRow {
  readonly tableName: string
  readonly rowCount: number
  readonly softDeletedCount: number
  readonly lastWriteAt: string | null
}

/** Database error for tables-overview lookups. */
export class TablesOverviewError extends Data.TaggedError('TablesOverviewError')<{
  readonly cause: unknown
}> {}

/**
 * Tables-Overview Repository Port.
 *
 * `aggregateTables` accepts the list of configured table names (sanitized
 * PostgreSQL identifiers) and returns one aggregate row per table. Missing
 * tables (newly created with no rows yet) produce a row with zeros and
 * `lastWriteAt: null`.
 */
export class TablesOverviewRepository extends Context.Service<
  TablesOverviewRepository,
  {
    readonly aggregateTables: (
      tableNames: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<TableAggregateRow>, TablesOverviewError>

    /**
     * Live row count per table — one entry per input table, in the same order.
     * The LEAN path for the cross-domain overview roll-up, which needs only the
     * summed live-record count and none of `aggregateTables`' extra aggregates
     * (soft-deleted count, last-write timestamp) or the ~24-bucket write-volume
     * series. Each table contributes its `COUNT(*) WHERE deleted_at IS NULL`;
     * missing tables (not yet created / removed at config time) contribute 0.
     * The per-table fan-out is bounded so a large table set cannot exhaust the
     * connection pool.
     */
    readonly countLiveRows: (
      tableNames: ReadonlyArray<string>
    ) => Effect.Effect<ReadonlyArray<number>, TablesOverviewError>

    /**
     * Per-table write count within `[windowStart, windowEnd)` — one entry per
     * input table, in the same order. A row "counts as a write" when its
     * `updated_at` falls in the window. Missing tables contribute 0.
     */
    readonly countWritesPerTable: (
      tableNames: ReadonlyArray<string>,
      windowStart: Readonly<Date>,
      windowEnd: Readonly<Date>
    ) => Effect.Effect<ReadonlyArray<number>, TablesOverviewError>

    /**
     * Write count SUMMED across all input tables for each bucket window — one
     * entry per bucket, in order. Backs the overview's write-volume series
     * (`series.points[].writes`). Buckets are iterated sequentially so a wide
     * series cannot swamp SQLite's single-writer connection.
     */
    readonly countWritesPerBucket: (
      tableNames: ReadonlyArray<string>,
      buckets: ReadonlyArray<{ readonly start: Readonly<Date>; readonly end: Readonly<Date> }>
    ) => Effect.Effect<ReadonlyArray<number>, TablesOverviewError>
  }
>()('TablesOverviewRepository') {}
