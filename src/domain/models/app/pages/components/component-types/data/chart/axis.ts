/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optStr } from '../../../shared-schemas'

/**
 * Display format for axis values.
 */
export const AxisFormatSchema = Schema.Literal('date', 'currency', 'number', 'percent').annotations(
  {
    title: 'Axis Format',
    description: 'Display format applied to axis tick labels',
  }
)

/**
 * Axis scale type.
 */
export const AxisScaleSchema = Schema.Literal('linear', 'logarithmic').annotations({
  title: 'Axis Scale',
  description: 'Scale type for numeric axes',
})

/**
 * Axis configuration for X or Y axis.
 */
export const ChartAxisSchema = Schema.Struct({
  /** Table field to map to this axis */
  field: Schema.String.annotations({
    description: 'Table field name mapped to this axis',
  }),
  /** Custom axis label text */
  label: optStr('Custom axis title text'),
  /** Display format for tick values */
  format: Schema.optional(AxisFormatSchema),
  /** Axis scale type (numeric axes only) */
  scale: Schema.optional(AxisScaleSchema),
  /** Show grid lines along this axis */
  gridLines: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show reference grid lines (default: false)' })
  ),
}).annotations({
  title: 'Chart Axis',
  description: 'Configuration for a chart axis (X or Y)',
})

/** @public */
export type AxisFormat = Schema.Schema.Type<typeof AxisFormatSchema>
/** @public */
export type AxisScale = Schema.Schema.Type<typeof AxisScaleSchema>
/** @public */
export type ChartAxis = Schema.Schema.Type<typeof ChartAxisSchema>
