/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Legend position options.
 */
export const LegendPositionSchema = Schema.Literal(
  'top',
  'bottom',
  'left',
  'right',
  'none'
).annotations({
  title: 'Legend Position',
  description: 'Position of the chart legend',
})

/**
 * Chart legend configuration.
 */
export const ChartLegendSchema = Schema.Struct({
  /** Legend position relative to the chart */
  position: Schema.optional(LegendPositionSchema),
  /** Whether the legend is visible */
  visible: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show or hide the legend (default: true)' })
  ),
}).annotations({
  title: 'Chart Legend',
  description: 'Legend display configuration',
})

/** @public */
export type LegendPosition = Schema.Schema.Type<typeof LegendPositionSchema>
/** @public */
export type ChartLegend = Schema.Schema.Type<typeof ChartLegendSchema>
