/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema, DataSortSchema } from '../../data-source'

/**
 * Dynamic option source for a `select` — the narrow, select-shaped `dataSource`.
 *
 * ## Why a dedicated schema instead of the shared `dataBoundFields`
 *
 * The shared `dataBoundFields` bundle is ROWS-oriented: it carries `autoSave`
 * and `search` alongside a `DataSourceSchema` whose `mode` / `pagination` /
 * `param` / `searchEngine` / `bindTo` controls all describe a component that
 * RENDERS records. A `select` renders a *choice list*, not records — spreading
 * that bundle would validate a dozen properties the control can never honour,
 * which is exactly the "config that validates and silently does nothing" class
 * of defect this schema exists to avoid.
 *
 * Narrowing the shared `dataSource` per component is the ESTABLISHED pattern,
 * not a new one: `chart` (`ChartDataSourceSchema`) and `kpi`
 * (`KpiDataSourceSchema`) both override the shared binding with a
 * series-/scalar-shaped one for the same reason.
 *
 * ## Resolution contract (SERVER-SIDE, before render)
 *
 * `resolveSelectOptionSources` runs as a page-render pass and REPLACES this
 * binding with a concrete `options` array on the component:
 *
 *   `{ type: 'select', dataSource: { table: 'categories', displayField: 'name' } }`
 *     ─ resolve ─▶
 *   `{ type: 'select', options: [{ value: '<row id>', label: '<row name>' }, …] }`
 *
 * After that pass NO `select` in the tree carries a `dataSource`. Two
 * consequences are load-bearing:
 *
 *  1. The rows-oriented `resolvePageDataSources` (which keys off
 *     `component.dataSource`) never sees a select and cannot mis-handle one as
 *     a record-rendering component.
 *  2. The table name and any `filter` never reach the client bundle — the
 *     island receives only the resolved label/value pairs (security rule S4).
 *
 * ## Bounded by construction
 *
 * `limit` caps the resolved list (default 100, hard max 1000). An option list
 * is server-rendered into the page, so an uncapped bind to a large table would
 * inline that table into the HTML. A picker over a large table is a DIFFERENT
 * capability — a searchable, debounced, server-side candidate fetch, for which
 * the prior art already exists in `src/presentation/islands/data-table/editors/`
 * (`fetching-picker.tsx`, `option-listbox.tsx`, `picker-search-box.tsx`) — and
 * is deliberately NOT expressed here.
 *
 * @example
 * ```yaml
 * - type: select
 *   dataSource:
 *     table: categories
 *     displayField: name       # required — the row field shown to the user
 *     valueField: id           # optional — defaults to 'id'
 *     sort: [{ field: name, direction: asc }]
 *     filter: [{ field: archived, operator: eq, value: false }]
 *     limit: 50
 *   props: { id: category-filter, label: Filter by Category }
 * ```
 */
export const SelectOptionSourceSchema = Schema.Struct({
  /** Table to read the option rows from (cross-validated against `app.tables`). */
  table: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'Table to read option rows from (validated against app.tables)',
      examples: ['categories', 'countries'],
    })
  ),
  /**
   * Row field supplying each option's LABEL.
   *
   * Required on purpose: there is no defensible default. Guessing (`'name'`,
   * the first text field, …) produces blank labels on any table that does not
   * happen to match — a control that validates and renders empty rows, which is
   * worse than a boot error naming the missing property.
   */
  displayField: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: "Row field supplying each option's display label (validated against the table)",
      examples: ['name', 'title'],
    })
  ),
  /**
   * Row field supplying each option's VALUE. Defaults to `'id'` — every Sovrium
   * table has one, so the default is safe rather than a guess.
   */
  valueField: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description:
          "Row field supplying each option's submitted value (validated against the table; default: 'id')",
        examples: ['id', 'slug'],
      })
    )
  ),
  /**
   * Filter conditions (AND logic) narrowing the option rows.
   *
   * Accepts the same `$currentUser.*` references as any other data binding;
   * they are resolved server-side per request by the shared
   * `current-user-resolver`, so a per-user option list is a supported binding
   * rather than a silently-unmatched literal string.
   */
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotate({
      description: 'Filter conditions (AND logic) narrowing the option rows',
    })
  ),
  /**
   * Sort rules applied in order.
   *
   * Strongly recommended: without one the option order is whatever the database
   * returns, which is neither stable across engines nor reproducible in a test.
   */
  sort: Schema.optional(
    Schema.Array(DataSortSchema).annotate({
      description: 'Sort rules applied in order (omit at the cost of a non-deterministic order)',
    })
  ),
  /** Maximum number of options to resolve (default 100, hard max 1000). */
  limit: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(1000)),
      Schema.annotate({
        description:
          'Maximum number of options to resolve. Default 100, hard max 1000 — the list is server-rendered into the page.',
        examples: [50, 200],
      })
    )
  ),
}).annotate({
  identifier: 'SelectOptionSource',
  title: 'Select Option Source',
  description:
    'Dynamic option source for a select: resolves table rows into label/value options server-side before render. Mutually exclusive with a static `options` array.',
})

/** Default `valueField` when the binding omits one. */
export const SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD = 'id'

/** Default `limit` when the binding omits one. */
export const SELECT_OPTION_SOURCE_DEFAULT_LIMIT = 100

/** @public */
export type SelectOptionSource = Schema.Schema.Type<typeof SelectOptionSourceSchema>
