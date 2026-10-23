/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FieldConditionSchema } from '@/domain/models/app/tables/condition-operators'
import { ToneSchema } from '../../../shared-schemas'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { ChartAggregateSchema } from './aggregate'
import { ChartAxisSchema } from './axis'
import { ChartDataSourceSchema } from './data-source'
import { ChartLegendSchema } from './legend'
import { ChartSeriesSchema } from './series'
import { ChartTooltipSchema } from './tooltip'

// ---------------------------------------------------------------------------
// Chart Type (kept in index as it's a simple literal)
// ---------------------------------------------------------------------------

/**
 * Supported chart visualization types.
 */
export const ChartTypeSchema = Schema.Literals([
  'bar',
  'line',
  'pie',
  'area',
  'donut',
  'scatter',
  'radar',
  'radial',
]).annotate({
  title: 'Chart Type',
  description:
    "Visualization type for the chart component. 'radar' draws one spoke per category and joins the values into one shape; 'radial' draws one arc per category around a common centre.",
})

/** @public */
export type ChartType = Schema.Schema.Type<typeof ChartTypeSchema>

/**
 * How much of a chart is drawn around its marks.
 *
 * `full` is every chart as it has always been drawn: axes, ticks, grid lines
 * when asked for, a legend when declared. `strip` draws the marks alone — a
 * row of hourly bars or a line of uptime checks beside a KPI — and keeps what
 * a reader still needs from them: the tooltip on hover, and an accessible
 * name on the frame built from the chart's label and its figure.
 */
const ChartVariantSchema = Schema.Literals(['full', 'strip']).annotate({
  title: 'Chart Variant',
  description:
    "How much is drawn around the marks. 'full' (default) draws the axes, their tick labels, the grid lines asked for and the legend. 'strip' draws the marks alone, with no axis, tick label, grid line or legend: the tooltip still answers a hover, the bars keep a fixed gap so 24 or 30 of them read as cells, and the frame is named by the chart's label and its total.",
})

/**
 * One colour rule for the bars of a bar chart: the bars whose record matches
 * `when` are painted in `tone`. The same vocabulary a grid's `cellStyle` and an
 * action's `visibleWhen` use — a field and its operators, a semantic tone — so
 * a check strip reads failed checks in the error colour without a new grammar.
 * The first matching rule wins; a bar no rule matches keeps the series colour.
 */
const ChartBarColorRuleSchema = Schema.Struct({
  when: FieldConditionSchema,
  tone: ToneSchema,
}).annotate({
  title: 'Bar Colour Rule',
  description:
    "Paints the bars whose record matches `when` (a field and its operators, as in a grid's visibleWhen) in `tone`: success, warning, error or muted. The first matching rule wins; a bar no rule matches keeps the series colour.",
})

// ---------------------------------------------------------------------------
// Component type definition
// ---------------------------------------------------------------------------

export const ChartTypeLiteral = Schema.Literal('chart')

export const chartFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  // Override the shared (table-only) `dataSource` with the chart-specific
  // discriminated union so a chart can bind to either a DB table (unchanged,
  // series over DB rows) OR a system read endpoint (series over endpoint rows).
  // Must come AFTER `...dataBoundFields` to replace its `dataSource`.
  dataSource: Schema.optional(ChartDataSourceSchema),
  chartType: Schema.optional(ChartTypeSchema),
  xAxis: Schema.optional(ChartAxisSchema),
  yAxis: Schema.optional(ChartAxisSchema),
  series: Schema.optional(
    Schema.Array(ChartSeriesSchema).pipe(
      Schema.annotate({ description: 'Data series definitions for chart component' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  legend: Schema.optional(ChartLegendSchema),
  tooltip: Schema.optional(ChartTooltipSchema),
  chartAggregate: Schema.optional(ChartAggregateSchema),
  /**
   * A fixed plot height in pixels. Omitted, the height follows the width, as
   * it always has; set, the plot is that tall at every width and the width
   * stays fluid — a 32 px row of bars beside a KPI.
   */
  height: Schema.optional(
    Schema.Int.pipe(
      Schema.annotate({
        description:
          'Plot height in pixels, the same at every width; the width stays fluid. Omitted, the engine derives the height from the width, keeping the plot wider than it is tall.',
        examples: [32, 240],
      }),
      Schema.check(Schema.isGreaterThanOrEqualTo(8), Schema.isLessThanOrEqualTo(1200))
    )
  ),
  chartVariant: Schema.optional(ChartVariantSchema),
  /**
   * Per-bar colours on a bar chart drawn from records: a check strip paints
   * its failed checks in the error tone. See {@link ChartBarColorRuleSchema}.
   */
  barColor: Schema.optional(
    Schema.Array(ChartBarColorRuleSchema).pipe(
      Schema.annotate({
        description:
          'Colour rules for the bars of a bar chart, matched against the record each bar draws, first match wins: [{ when: { field: ok, eq: false }, tone: error }].',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Whether a pie or donut writes each slice's label on the ring. Turn it off
   * when a legend beside the chart already names every slice, or when a small
   * chart has no room for them. Bar, line and area charts carry their labels on
   * their axes, which `xAxis` and `yAxis` already control.
   */
  dataLabels: Schema.optional(
    Schema.Boolean.annotate({
      description:
        "Whether a pie or donut chart writes each slice's label on the ring (default: true). Turn it off when the legend already names every slice.",
    })
  ),
  emptyMessage: Schema.optional(
    Schema.String.annotate({
      description: 'Message displayed when the chart data source returns no records',
      examples: ['No sales data available', 'No metrics yet'],
    })
  ),
  // Optional NAMED empty-state region. When set, a chart whose data source
  // returns ZERO rows renders an accessible ARIA landmark region (role +
  // accessible name) instead of the default UNNAMED empty placeholder
  // (`emptyMessage` / `ChartEmpty`). This lets a system-bound chart announce a
  // page-level "no data" region a screen-reader user can navigate to — the
  // generic capability behind the page-analytics surface conversion's
  // `region "Aucune donnée"` empty state. Present-when-empty, absent-when-populated:
  // when the chart has rows it renders the normal `<svg role="img">` and NO region.
  // Purely ADDITIVE — charts without `emptyState` keep the plain unnamed empty.
  emptyState: Schema.optional(
    Schema.Struct({
      // ARIA landmark role for the empty-state region. Kept as an explicit
      // literal (currently only `'region'`) so future landmark roles widen this
      // union additively without changing existing configs.
      role: Schema.Literal('region').annotate({
        description: 'ARIA landmark role for the empty-state region (currently only "region")',
      }),
      // Accessible name (aria-label) announced to screen-reader users when the
      // chart data source returns zero rows.
      name: Schema.String.pipe(
        Schema.annotate({
          description:
            'Accessible name (aria-label) for the empty-state region, rendered when the chart data source returns zero rows',
          examples: ['Aucune donnée', 'No data'],
        }),
        Schema.check(Schema.isMinLength(1))
      ),
      // Body text rendered inside the region; falls back to `emptyMessage`, then
      // a generic default, when omitted.
      title: Schema.optional(
        Schema.String.annotate({
          description:
            'Body text inside the empty-state region (falls back to emptyMessage, then a default, when omitted)',
          examples: ['Aucune visite sur la période'],
        })
      ),
    }).annotate({
      title: 'Chart Empty State',
      description:
        'When set, the chart renders a NAMED ARIA region (role + accessible name) instead of the default unnamed empty placeholder when its data source returns zero rows. Present-when-empty, absent-when-populated.',
    })
  ),
} as const

// ---------------------------------------------------------------------------
// Re-export all sub-schemas
// ---------------------------------------------------------------------------

export type { ChartSystemSource } from './data-source'
