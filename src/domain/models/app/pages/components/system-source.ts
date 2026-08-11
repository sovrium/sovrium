/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterBindingSchema } from './data-source'

// ---------------------------------------------------------------------------
// Shared system read-endpoint source (rows envelope)
// ---------------------------------------------------------------------------

/**
 * System read-endpoint binding — feeds a data-bound component its ROWS from a
 * named read endpoint (any `/api/admin/*` or system read route) instead of a
 * declared DB table.
 *
 * This is the shared, generalized "rows-envelope" shape that was first proven on
 * `data-table` (`DataTableSystemSourceSchema`). It is the canonical READ-source
 * binding for the rows-oriented data-bound components (data-table + the list
 * family: kanban / calendar / gallery / list / data-timeline). It is reused —
 * not re-copied — so every rows-oriented component speaks the same envelope.
 *
 * `chart` and `kpi` deliberately keep their own SPECIALIZED system sources
 * (series-shaped and scalar-shaped respectively) and do NOT use this schema.
 *
 * Envelope contract:
 *  - the component fetches `endpoint` (merging `query` static params with the
 *    component's own sort/search/filter params) instead of `/api/tables/:t/records`;
 *  - the `{ [rowsKey]: [...rows] }` response is normalized to the component's
 *    records (total = `[totalKey]` if present, else rows length);
 *  - `app.tables` column cross-validation is SKIPPED (the columns/fields describe
 *    the endpoint's shape, not a declared table).
 *
 * NOTE: this is a READ source. Write surfaces (e.g. `form`) must NOT accept it —
 * they override `dataSource` back to the DB-only `DataSourceSchema`.
 *
 * @example
 * ```yaml
 * dataSource:
 *   system:
 *     endpoint: /api/admin/automations/runs
 *     rowsKey: items        # default 'items'
 *     idKey: id             # default 'id'
 *     totalKey: total       # optional; falls back to rows length
 *     query:                # optional STATIC params merged into every request
 *       status: failed
 * ```
 */
export const SystemSourceSchema = Schema.Struct({
  /** The named read endpoint to fetch rows from (required) */
  endpoint: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Read endpoint path to fetch rows from (e.g. /api/admin/automations/runs)',
      examples: ['/api/admin/automations/runs'],
    })
  ),
  /** Array key in the response envelope (default: 'items') */
  rowsKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of the rows array in the response envelope (default: 'items')",
    })
  ),
  /** Row id key used to identify rows (default: 'id') */
  idKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of each row's unique id (default: 'id')",
    })
  ),
  /** Optional total-count key; falls back to rows length when absent */
  totalKey: Schema.optional(
    Schema.String.annotations({
      description: 'Key of the total-count in the envelope; falls back to rows length if absent',
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
  /**
   * ID of a sibling shared filter/period selector whose published params drive
   * this system read (cross-component binding). The DYNAMIC counterpart to the
   * static `query`: the publisher's current selection is merged into every
   * request to `endpoint` alongside `query`. Reuses the same publisher-id
   * mechanism as the DB-table form's `bindTo`.
   */
  bindTo: Schema.optional(
    Schema.String.annotations({
      description:
        'ID of a sibling shared filter/period selector whose published params are merged into every request to endpoint (the dynamic counterpart to the static query)',
    })
  ),
  /**
   * Shared-filter param mapping (companion to `bindTo`). Selects which of the
   * publisher's published params this subscriber merges. Inert without `bindTo`.
   */
  sharedFilter: Schema.optional(
    SharedFilterBindingSchema.annotations({
      description:
        'Companion to bindTo: the shared selector params merged (dynamically) into every request to endpoint, alongside the static query. Inert without bindTo.',
    })
  ),
}).annotations({
  title: 'System Source',
  description:
    'Read-endpoint binding: feed a data-bound component from a system endpoint instead of a DB table',
})

/** @public */
export type SystemSource = Schema.Schema.Type<typeof SystemSourceSchema>
