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
export const AxisFormatSchema = Schema.Literals(['date', 'currency', 'number', 'percent']).annotate(
  {
    title: 'Axis Format',
    description: 'Display format applied to axis tick labels',
  }
)

/**
 * Axis scale type.
 */
export const AxisScaleSchema = Schema.Literals(['linear', 'logarithmic', 'time']).annotate({
  title: 'Axis Scale',
  description:
    "How values are placed along the axis. 'linear' and 'logarithmic' are for a numeric axis. 'time' places each bucket of a date or datetime axis at its instant on a bar, line or area chart, so a gap in time is a gap on the axis, and chooses regular ticks (every 6 hours across a day) rather than one per bucket, in the operator timezone.",
})

/**
 * Axis configuration for X or Y axis.
 */
export const ChartAxisSchema = Schema.Struct({
  /** Table field to map to this axis */
  field: Schema.String.annotate({
    description: 'Table field name mapped to this axis',
  }),
  /** Custom axis label text */
  label: optStr('Custom axis title text'),
  /** Display format for tick values */
  format: Schema.optional(AxisFormatSchema),
  /** How values are placed: linear or logarithmic (numeric), time (dated buckets) */
  scale: Schema.optional(AxisScaleSchema),
  /** Show grid lines along this axis */
  gridLines: Schema.optional(
    Schema.Boolean.annotate({ description: 'Show reference grid lines (default: false)' })
  ),
}).annotate({
  title: 'Chart Axis',
  description: 'Configuration for a chart axis (X or Y)',
})

/** @public */
export type AxisFormat = Schema.Schema.Type<typeof AxisFormatSchema>
/** @public */
export type AxisScale = Schema.Schema.Type<typeof AxisScaleSchema>
/** @public */
export type ChartAxis = Schema.Schema.Type<typeof ChartAxisSchema>
