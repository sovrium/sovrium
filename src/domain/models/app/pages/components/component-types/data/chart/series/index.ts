/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optStr } from '../../../../shared-schemas'

/**
 * A single data series on the chart.
 */
export const ChartSeriesSchema = Schema.Struct({
  /** Table field for the series values */
  field: Schema.String.annotations({
    description: 'Table field name for series data',
  }),
  /** Series display label (legend, tooltip) */
  label: optStr('Display name for the series'),
  /** Series color (theme token or hex) */
  color: Schema.optional(
    Schema.String.annotations({
      description: 'Series color — theme token name or hex value (e.g. #3b82f6)',
    })
  ),
  /** Stack group name — series with the same stack name are stacked */
  stack: Schema.optional(
    Schema.String.annotations({ description: 'Stack group name for stacked bar/area charts' })
  ),
  /** Area fill opacity (0-1, for area/donut types) */
  fillOpacity: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1),
      Schema.annotations({ description: 'Area fill opacity between 0 and 1' })
    )
  ),
}).annotations({
  title: 'Chart Series',
  description: 'Single data series configuration',
})

/** @public */
export type ChartSeries = Schema.Schema.Type<typeof ChartSeriesSchema>
