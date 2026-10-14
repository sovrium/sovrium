/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SeriesChart, type SeriesChartArgs } from './series-chart'
import type { ChartSeriesConfig } from './chart-series-shared'
import type { ReactElement } from 'react'

/**
 * The series-bound canvases: one mark per declared `series` entry.
 */

/** True when the chart declares at least one explicit data series. */
export function hasSeries(
  series: readonly ChartSeriesConfig[] | undefined
): series is readonly ChartSeriesConfig[] {
  return Array.isArray(series) && series.length > 0
}

/**
 * Renders a multi-series chart with an interactive legend: one mark per
 * declared `series` entry, shaped by the `chartType`.
 */
export function renderSeriesChart(args: SeriesChartArgs): ReactElement {
  return <SeriesChart {...args} />
}
