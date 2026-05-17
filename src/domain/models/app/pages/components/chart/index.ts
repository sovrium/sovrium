/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Chart sub-schemas - re-exports from component-types/data/chart/
 *
 * This file is a backward-compatibility barrel. The canonical definitions
 * now live in component-types/data/chart/.
 */
export {
  AxisFormatSchema,
  AxisScaleSchema,
  ChartAxisSchema,
  type AxisFormat,
  type AxisScale,
  type ChartAxis,
} from '../component-types/data/chart/axis'

export { ChartSeriesSchema, type ChartSeries } from '../component-types/data/chart/series'

export {
  LegendPositionSchema,
  ChartLegendSchema,
  type LegendPosition,
  type ChartLegend,
} from '../component-types/data/chart/legend'

export { ChartTooltipSchema, type ChartTooltip } from '../component-types/data/chart/tooltip'

export {
  ChartAggregateFunctionSchema,
  ChartDateIntervalSchema,
  ChartAggregateSchema,
  type ChartAggregateFunction,
  type ChartDateInterval,
  type ChartAggregate,
} from '../component-types/data/chart/aggregate'

export { ChartTypeSchema, type ChartType } from '../component-types/data/chart'
