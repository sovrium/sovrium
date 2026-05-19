/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import {
  periodPresetSchema,
  seriesIntervalSchema,
} from '@/domain/models/api/admin/_shared/period-preset'

export const tablesOverviewQuerySchema = z
  .object({
    period: periodPresetSchema
      .default('24h')
      .describe('Time window for `series` and `writesInPeriod` aggregations. Default `24h`.'),
  })
  .openapi('TablesOverviewQuery')

export type TablesOverviewQuery = z.infer<typeof tablesOverviewQuerySchema>

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

export type TableOverviewBreakdownItem = z.infer<typeof tableOverviewBreakdownItemSchema>

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

export type TablesOverviewResponse = z.infer<typeof tablesOverviewResponseSchema>
