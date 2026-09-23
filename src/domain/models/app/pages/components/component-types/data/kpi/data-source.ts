/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../../data-source'

// ---------------------------------------------------------------------------
// KPI data-source binding (discriminated: DB table OR system read endpoint)
// ---------------------------------------------------------------------------

/**
 * DB-table KPI data source — the original binding: a declared `table` (and the
 * full set of optional `DataSourceSchema` controls: view/filter/sort/mode/...).
 *
 * This variant is COMPLETELY UNCHANGED — it is the SHARED `DataSourceSchema`, so
 * every existing KPI config (`{ table }`, `{ table, filter }`,
 * `{ table, mode, filter }`, ...) keeps validating and aggregating client-side
 * exactly as before. Cross-validated against `app.tables`.
 */
export const KpiDbDataSourceSchema = DataSourceSchema

/**
 * System read-endpoint binding — feeds the KPI a single PRE-COMPUTED scalar from
 * a named read endpoint (any `/api/admin/*` or system read route) instead of
 * aggregating a declared DB table.
 *
 * When this variant is used:
 *  - the KPI fetches `system.endpoint` (merging `system.query` static params)
 *    instead of `/api/tables/:t/records`;
 *  - it reads the scalar at `valuePath` (a dotted path into the JSON envelope),
 *    OR interpolates `{dotted.path}` tokens in `valueTemplate` from the SAME
 *    envelope into a composite value;
 *  - `kpiFormat` formats the value-path scalar (the template result is already a
 *    string and bypasses numeric formatting);
 *  - `app.tables` cross-validation is SKIPPED (no declared table);
 *  - `kpiAggregate` is ignored (the endpoint already pre-computed the scalar).
 *
 * Exactly one of `valuePath` / `valueTemplate` should be configured. A fetch
 * failure or a missing path degrades CALMLY to the neutral em-dash placeholder.
 *
 * @example
 * ```yaml
 * dataSource:
 *   system:
 *     endpoint: /api/admin/overview     # required — the read endpoint path
 *     valuePath: records.total          # dotted path to a scalar in the envelope
 *     query: { period: 24h }            # optional STATIC query params merged in
 * # — or a value template —
 * dataSource:
 *   system:
 *     endpoint: /api/admin/overview
 *     valueTemplate: '{connections.healthy}/{connections.total}'
 * ```
 */
export const KpiSystemSourceSchema = Schema.Struct({
  /** The named read endpoint to fetch the scalar from (required) */
  endpoint: Schema.String.pipe(
    Schema.annotate({
      description: 'Read endpoint path to fetch the scalar from (e.g. /api/admin/overview)',
      examples: ['/api/admin/overview'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Dotted path to a single scalar in the response envelope (e.g. records.total) */
  valuePath: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Dotted path to a single scalar in the fetched envelope',
        examples: ['records.total', 'storage.totalBytes'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Value template interpolating `{dotted.path}` tokens from the SAME envelope
   * into a composite string value (e.g. "{connections.healthy}/{connections.total}").
   * Mutually exclusive with `valuePath`.
   */
  valueTemplate: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Template interpolating {dotted.path} tokens from the fetched envelope',
        examples: ['{connections.healthy}/{connections.total}'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Static query params merged into the request to the endpoint */
  query: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    ).annotate({
      description: 'Static query params merged into the request to the endpoint',
    })
  ),
}).annotate({
  title: 'KPI System Source',
  description:
    'Read-endpoint binding: read a single pre-computed scalar (or a value template) from a system endpoint instead of aggregating a DB table',
})

/**
 * KPI data source binding — discriminated by which key is present:
 * - `{ table, ... }`                  → DB-table binding (unchanged, aggregated client-side)
 * - `{ system: { endpoint, ... } }`   → system read-endpoint binding (scalar value-path)
 */
export const KpiDataSourceSchema = Schema.Union([
  KpiDbDataSourceSchema,
  Schema.Struct({
    /** System read-endpoint binding (mutually exclusive with the DB-table form) */
    system: KpiSystemSourceSchema,
  }).annotate({
    title: 'KPI System Data Source',
    description: 'System read-endpoint binding for the KPI',
  }),
]).annotate({
  identifier: 'KpiDataSource',
  title: 'KPI Data Source',
  description:
    'Data binding for the KPI: a DB table (aggregated client-side) OR a system read endpoint (pre-computed scalar value-path)',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type KpiSystemSource = Schema.Schema.Type<typeof KpiSystemSourceSchema>
