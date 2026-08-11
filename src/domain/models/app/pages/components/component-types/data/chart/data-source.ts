/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../../data-source'

// ---------------------------------------------------------------------------
// Chart data-source binding (discriminated: DB table OR system read endpoint)
// ---------------------------------------------------------------------------

/**
 * DB-table chart data source — the original binding: a declared `table` (plus
 * the full set of optional `DataSourceSchema` controls: view/filter/sort/...).
 *
 * This variant is COMPLETELY UNCHANGED — it is the SHARED `DataSourceSchema`, so
 * every existing chart config (`{ table }`, `{ table, view }`,
 * `{ table, filter, sort }`, ...) keeps validating and rendering `series`/`xAxis`
 * over the DB rows exactly as before. Cross-validated against `app.tables`.
 */
export const ChartDbDataSourceSchema = DataSourceSchema

/**
 * System read-endpoint binding — feeds the chart its ROWS from a named read
 * endpoint (any `/api/admin/*`, `/api/analytics/*`, or system read route)
 * instead of a declared DB table.
 *
 * When this variant is used:
 *  - the chart fetches `system.endpoint` (merging `system.query` static params)
 *    instead of `/api/tables/:t/records`;
 *  - it reads the rows array at `rowsKey` (default `'items'`), normalizes
 *    `{ [rowsKey]: [...rows] }` to the chart's records, and renders the existing
 *    `series`/`xAxis`/`chartType` config over those rows;
 *  - `app.tables` cross-validation is SKIPPED (no declared table) — the chart
 *    must NOT fall into the "missing dataSource.table binding" warning state.
 *
 * Same shape as the data-table system source MINUS the grid-only `idKey` /
 * `totalKey` (a chart reads rows for series, not paginated identified records).
 *
 * @example
 * ```yaml
 * dataSource:
 *   system:
 *     endpoint: /api/analytics/overview   # required — the read endpoint path
 *     rowsKey: timeSeries                 # array key in the envelope (default 'items')
 *     query: { from: ..., to: ..., granularity: day }   # optional STATIC params
 * ```
 */
export const ChartSystemSourceSchema = Schema.Struct({
  /** The named read endpoint to fetch rows from (required) */
  endpoint: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Read endpoint path to fetch rows from (e.g. /api/analytics/overview)',
      examples: ['/api/analytics/overview'],
    })
  ),
  /** Array key in the response envelope (default: 'items') */
  rowsKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of the rows array in the response envelope (default: 'items')",
    })
  ),
  /** Static query params merged into every request to the endpoint */
  query: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
    }).annotations({
      description: 'Static query params merged into every request to the endpoint',
    })
  ),
}).annotations({
  title: 'Chart System Source',
  description:
    'Read-endpoint binding: feed the chart rows from a system endpoint instead of a DB table',
})

/**
 * Chart data source binding — discriminated by which key is present:
 * - `{ table, ... }`                  → DB-table binding (unchanged, series over DB rows)
 * - `{ system: { endpoint, ... } }`   → system read-endpoint binding (series over endpoint rows)
 */
export const ChartDataSourceSchema = Schema.Union(
  ChartDbDataSourceSchema,
  Schema.Struct({
    /** System read-endpoint binding (mutually exclusive with the DB-table form) */
    system: ChartSystemSourceSchema,
  }).annotations({
    title: 'Chart System Data Source',
    description: 'System read-endpoint binding for the chart',
  })
).annotations({
  identifier: 'ChartDataSource',
  title: 'Chart Data Source',
  description:
    'Data binding for the chart: a DB table (series over DB rows) OR a system read endpoint (series over endpoint rows)',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type ChartSystemSource = Schema.Schema.Type<typeof ChartSystemSourceSchema>
