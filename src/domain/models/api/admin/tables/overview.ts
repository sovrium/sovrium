/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/tables/overview`.
 *
 * Third Phase-0 admin overview endpoint (after automations and users). Returns
 * per-table row counts, soft-delete counts, last-write timestamps, and a
 * bucketed write-volume series. Hardens the overview pattern across a third
 * domain — the symmetry argument behind D1/D5/CC-2 is now load-bearing across
 * automations, users, and tables.
 *
 * Source story: docs/user-stories/as-business-admin/tables/tables-overview.md
 *
 * @see plan-design §10 (locked 2026-05-09) — overview shape contract
 * @see keystone plan §12 Q1 — three-tier RBAC (admin / operator / auditor)
 * @see audit-log story §305 — `table` (singular) resource type catalog
 */

import { z } from '@hono/zod-openapi'
import {
  periodPresetSchema,
  seriesIntervalSchema,
} from '@/domain/models/api/admin/_shared/period-preset'

/**
 * Query parameters for `GET /api/admin/tables/overview`.
 *
 * Single optional query param (`?period=`) reusing the shared
 * `periodPresetSchema` (`'24h' | '7d' | '30d'`, default `'24h'`). The series
 * interval in the response is derived from this param (`1h` for `24h`,
 * `1d` for `7d` and `30d`) — operators do not pass an explicit interval.
 */
export const tablesOverviewQuerySchema = z
  .object({
    period: periodPresetSchema
      .default('24h')
      .describe('Time window for `series` and `writesInPeriod` aggregations. Default `24h`.'),
  })
  .openapi('TablesOverviewQuery')

/** @public */
export type TablesOverviewQuery = z.infer<typeof tablesOverviewQuerySchema>

/**
 * Per-table breakdown row.
 *
 * One entry per table visible to the calling admin tier. Sorted alphabetically
 * by `name` for stable dashboard rendering. `lastWriteAt` is nullable — `null`
 * for tables that have never been written to (newly created or empty
 * imports), otherwise an ISO 8601 UTC string ending in `Z`.
 *
 * Field-by-field rationale:
 * - `name`             — table slug as it appears in `tables[].name`
 * - `rowCount`         — live rows; soft-deleted rows excluded
 * - `softDeletedCount` — rows with `deleted_at IS NOT NULL`; cleared on
 *                        force-delete or restore
 * - `lastWriteAt`      — most recent `record.created/updated/deleted/restored`
 *                        emit timestamp; `null` when the table has never been
 *                        written to (the common dormant-archive case)
 * - `writesInPeriod`   — count of write-class audit emits for this table
 *                        within the requested period
 */
export const tableOverviewBreakdownItemSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .describe('Table slug as it appears in `tables[].name`. Sorted alphabetically.'),
    rowCount: z
      .number()
      .int()
      .nonnegative()
      .describe('Live row count. Soft-deleted rows are NOT included here.'),
    softDeletedCount: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Count of rows with `deleted_at IS NOT NULL`. Surfaces the operator cleanup backlog; cleared by force-delete or restore.'
      ),
    lastWriteAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 UTC timestamp of the most recent `record.created/updated/deleted/restored` emit for this table. `null` when the table has never been written to (newly created or empty import).'
      ),
    writesInPeriod: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Count of write-class audit emits (`record.created/updated/deleted/restored/batch_*`) for this table within the requested period.'
      ),
  })
  .openapi('TableOverviewBreakdownItem')

/** @public */
export type TableOverviewBreakdownItem = z.infer<typeof tableOverviewBreakdownItemSchema>

/**
 * Response shape of `GET /api/admin/tables/overview`.
 *
 * Three operator-grade reflections in one payload:
 *
 *   1. `totals`   — counts across every table the caller can see
 *   2. `by_table` — alphabetically-sorted per-table breakdown
 *   3. `series`   — bucketed write-volume time series whose `interval` is
 *                   derived from the query `period`
 *
 * Aggregation invariants enforced at the application layer (and asserted by
 * ADMIN-TABLES-OVERVIEW-007):
 *
 *   - `totals.tables === by_table.length`
 *   - `totals.total_rows === sum(by_table[].rowCount)`
 *   - `totals.soft_deleted_rows === sum(by_table[].softDeletedCount)`
 *   - `totals.writes_in_period === sum(by_table[].writesInPeriod)
 *                              === sum(series.points[].writes)`
 *
 * The shape is exposed under the OpenAPI name `TablesOverviewResponse` so
 * downstream tooling generates a stable type name.
 */
export const tablesOverviewResponseSchema = z
  .object({
    totals: z
      .object({
        tables: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Count of tables visible to the calling admin tier. Always equals `by_table.length`.'
          ),
        total_rows: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Sum of `by_table[].rowCount` across all tables. Soft-deleted rows are NOT included.'
          ),
        soft_deleted_rows: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Sum of `by_table[].softDeletedCount` across all tables. Surfaces the operator cleanup backlog.'
          ),
        writes_in_period: z
          .number()
          .int()
          .nonnegative()
          .describe(
            'Sum of `by_table[].writesInPeriod`; also equals the total of `series.points[].writes`.'
          ),
      })
      .describe('Aggregate totals across all tables for the requested period.'),
    by_table: z
      .array(tableOverviewBreakdownItemSchema)
      .describe(
        'Per-table breakdown, sorted alphabetically by `name` for stable dashboard rendering. Empty array when no tables are configured.'
      ),
    series: z
      .object({
        interval: seriesIntervalSchema,
        points: z
          .array(
            z.object({
              timestamp: z
                .string()
                .datetime()
                .describe(
                  'Bucket-start ISO 8601 UTC timestamp aligned to the interval (e.g. `T00:00:00.000Z` for daily buckets).'
                ),
              writes: z
                .number()
                .int()
                .nonnegative()
                .describe('Count of write-class audit emits across all tables within this bucket.'),
            })
          )
          .describe(
            'Time-series buckets for the requested period. Length is fixed by the period: 24 for `24h`, 7 for `7d`, 30 for `30d`.'
          ),
      })
      .describe(
        'Bucketed write-volume time series. `interval` is derived from the query `period`: `1h` for `24h`, `1d` for `7d` and `30d`.'
      ),
  })
  .openapi('TablesOverviewResponse')

/** @public */
export type TablesOverviewResponse = z.infer<typeof tablesOverviewResponseSchema>
