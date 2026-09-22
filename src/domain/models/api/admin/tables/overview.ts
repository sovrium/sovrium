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
 * Source story: [internal ref]
 *
 * @see plan-design §10 (locked 2026-05-09) — overview shape contract
 * @see keystone plan §12 Q1 — two-tier RBAC (admin / operator)
 * @see src/domain/models/api/admin/audit-log/action-catalog.ts — the authority
 *      on `resource.type`. `table.overview.queried` maps to the singular
 *      `table` because the action targets the table itself. (This previously
 *      cited a non-existent "audit-log story §305" — see the catalog's
 *      historical note.)
 */

import { Schema } from 'effect'
import {
  periodPresetSchema,
  seriesIntervalSchema,
} from '@/domain/models/api/admin/envelope/period-preset'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { withDefault } from '../../combinators/schema-defaults'

/**
 * Query parameters for `GET /api/admin/tables/overview`.
 *
 * Single optional query param (`?period=`) reusing the shared
 * `periodPresetSchema` (`'24h' | '7d' | '30d'`, default `'24h'`). The series
 * interval in the response is derived from this param (`1h` for `24h`,
 * `1d` for `7d` and `30d`) — operators do not pass an explicit interval.
 */
export const tablesOverviewQuerySchema = Schema.Struct({
  period: periodPresetSchema
    .annotate({
      description: 'Time window for `series` and `writesInPeriod` aggregations. Default `24h`.',
    })
    .pipe(withDefault('24h')),
}).annotate({ identifier: 'TablesOverviewQuery' })

/** @public */
export type TablesOverviewQuery = typeof tablesOverviewQuerySchema.Type

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
export const tableOverviewBreakdownItemSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'Table slug as it appears in `tables[].name`. Sorted alphabetically.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  rowCount: Schema.Int.annotate({
    description: 'Live row count. Soft-deleted rows are NOT included here.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  softDeletedCount: Schema.Int.annotate({
    description:
      'Count of rows with `deleted_at IS NOT NULL`. Surfaces the operator cleanup backlog; cleared by force-delete or restore.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  lastWriteAt: Schema.NullOr(
    looseIsoDateTime({
      description:
        'ISO 8601 UTC timestamp of the most recent `record.created/updated/deleted/restored` emit for this table. `null` when the table has never been written to (newly created or empty import).',
    })
  ),
  writesInPeriod: Schema.Int.annotate({
    description:
      'Count of write-class audit emits (`record.created/updated/deleted/restored/batch_*`) for this table within the requested period.',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
}).annotate({ identifier: 'TableOverviewBreakdownItem' })

/** @public */
export type TableOverviewBreakdownItem = typeof tableOverviewBreakdownItemSchema.Type

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
 * [internal ref]):
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
export const tablesOverviewResponseSchema = Schema.Struct({
  totals: Schema.Struct({
    tables: Schema.Int.annotate({
      description:
        'Count of tables visible to the calling admin tier. Always equals `by_table.length`.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    total_rows: Schema.Int.annotate({
      description:
        'Sum of `by_table[].rowCount` across all tables. Soft-deleted rows are NOT included.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    soft_deleted_rows: Schema.Int.annotate({
      description:
        'Sum of `by_table[].softDeletedCount` across all tables. Surfaces the operator cleanup backlog.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
    writes_in_period: Schema.Int.annotate({
      description:
        'Sum of `by_table[].writesInPeriod`; also equals the total of `series.points[].writes`.',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  }).annotate({ description: 'Aggregate totals across all tables for the requested period.' }),
  by_table: Schema.Array(tableOverviewBreakdownItemSchema).annotate({
    description:
      'Per-table breakdown, sorted alphabetically by `name` for stable dashboard rendering. Empty array when no tables are configured.',
  }),
  series: Schema.Struct({
    interval: seriesIntervalSchema,
    points: Schema.Array(
      Schema.Struct({
        timestamp: looseIsoDateTime({
          description:
            'Bucket-start ISO 8601 UTC timestamp aligned to the interval (e.g. `T00:00:00.000Z` for daily buckets).',
        }),
        writes: Schema.Int.annotate({
          description: 'Count of write-class audit emits across all tables within this bucket.',
        }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
      })
    ).annotate({
      description:
        'Time-series buckets for the requested period. Length is fixed by the period: 24 for `24h`, 7 for `7d`, 30 for `30d`.',
    }),
  }).annotate({
    description:
      'Bucketed write-volume time series. `interval` is derived from the query `period`: `1h` for `24h`, `1d` for `7d` and `30d`.',
  }),
}).annotate({ identifier: 'TablesOverviewResponse' })

/** @public */
export type TablesOverviewResponse = typeof tablesOverviewResponseSchema.Type
