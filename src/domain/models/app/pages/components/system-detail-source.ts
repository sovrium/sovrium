/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Shared system DETAIL-endpoint source (single-record envelope)
// ---------------------------------------------------------------------------

/**
 * System DETAIL-endpoint binding — feeds a record-bound component (record-drawer,
 * record-field, or a page-level `mode: single` dataSource) its SINGLE record from
 * a named detail / single-record read endpoint (e.g.
 * `/api/admin/automations/runs/:runId`, `/api/admin/forms/:f/submissions/:id`,
 * `/api/admin/connections/:id`) instead of the DB-table single-record route
 * `/api/tables/:t/records/:id`.
 *
 * This is the SINGLE-record counterpart to the rows-envelope `SystemSourceSchema`
 * (which feeds LIST components). The two shapes are deliberately DISTINCT — a rows
 * envelope is NOT a single record:
 *  - the rows envelope (`SystemSourceSchema`) extracts an ARRAY (`rowsKey`) plus a
 *    count (`totalKey`) and never injects a record id into the endpoint path;
 *  - this detail envelope injects the bound record id into the endpoint path via
 *    `param`, and extracts exactly ONE record (`recordKey`).
 *
 * That is why this campaign authors a NEW schema rather than reusing Phase 0's
 * `SystemSourceSchema`: `rowsKey`/`totalKey` are meaningless for a single record,
 * and the detail source needs `param` (id injection) + `recordKey` (single-record
 * extraction), which the rows envelope lacks.
 *
 * Drill-down contract (list → detail):
 *  - the component fetches `endpoint` with the bound record id substituted into the
 *    endpoint's `:param` placeholder — the row id from a system-source `table`
 *    (record-drawer) or the route parameter for a page-level `mode: single`;
 *  - the response is normalized to the single record at `recordKey` (or the whole
 *    response body when `recordKey` is absent); the record's id is read from `idKey`;
 *  - `query` static params are merged into the request;
 *  - `app.tables` cross-validation is SKIPPED — the resolved record describes the
 *    endpoint's shape, not a declared table.
 *
 * NOTE: this is a READ source. The consuming component's field/control set
 * (record-drawer `recordFields`, record-field `props.field`, page `$record.*`) is
 * authored separately and describes the endpoint envelope, not a declared table.
 *
 * @example
 * ```yaml
 * dataSource:
 *   system:
 *     endpoint: /api/admin/automations/runs/:runId   # required; :runId is the id slot
 *     param: runId          # row id / route param injected into :runId (default 'id')
 *     recordKey: run        # envelope key holding the record (default: whole body)
 *     idKey: id             # the record's id key (default 'id')
 *     query:                # optional STATIC params merged into the request
 *       include: steps
 * ```
 */
export const SystemDetailSourceSchema = Schema.Struct({
  /** The named detail endpoint to fetch the single record from (required) */
  endpoint: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description:
        'Detail endpoint path to fetch one record from. The bound record id is injected into the `:param` placeholder (e.g. /api/admin/automations/runs/:runId)',
      examples: ['/api/admin/automations/runs/:runId'],
    })
  ),
  /**
   * Param whose value is injected into the endpoint's `:param` placeholder
   * (default 'id'). For a record-drawer this is the clicked row's id key; for a
   * page-level `mode: single` it is the route parameter name.
   */
  param: Schema.optional(
    Schema.String.annotate({
      description:
        "Param injected into the endpoint's `:param` placeholder — the clicked row id (record-drawer) or the route parameter (page mode:single). Default 'id'.",
      examples: ['runId', 'id', 'submissionId'],
    })
  ),
  /** Envelope key holding the single record (default: the whole response body) */
  recordKey: Schema.optional(
    Schema.String.annotate({
      description:
        'Key of the single record in the response envelope (e.g. `run`). Falls back to the whole response body when absent.',
    })
  ),
  /** The resolved record's unique id key (default 'id') */
  idKey: Schema.optional(
    Schema.String.annotate({
      description: "Key of the resolved record's unique id (default 'id')",
    })
  ),
  /** Static query params merged into the request to the detail endpoint */
  query: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    ).annotate({
      description: 'Static query params merged into the request to the detail endpoint',
    })
  ),
}).annotate({
  title: 'System Detail Source',
  description:
    'Detail-endpoint binding: feed a record-bound component a single record from a system detail endpoint instead of /api/tables/:t/records/:id',
})

/** @public */
export type SystemDetailSource = Schema.Schema.Type<typeof SystemDetailSourceSchema>
