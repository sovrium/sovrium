/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo, type ReactElement } from 'react'
import { ChartCanvas, type ChartCanvasProps } from './chart-canvas'
import { ChartShapeContext, NO_SHAPE, type ChartBarColorRule, type ChartShape } from './chart-shape'

/** What a chart declares about its drawing, and the window its `fillEmpty` fills. */
export interface ChartShapeProps {
  readonly height?: number
  readonly chartVariant?: 'full' | 'strip'
  readonly barColor?: readonly ChartBarColorRule[]
  readonly fillWindow?: { readonly from: string; readonly to: string }
}

/**
 * The chart canvas under its declared shape: every canvas below reads the
 * height, the variant and the bar colours from context, and the aggregate
 * carries the window the server resolved for `fillEmpty`.
 */
export function ShapedChartCanvas({
  shape,
  chartAggregate,
  ...canvas
}: ChartCanvasProps & { readonly shape: ChartShapeProps }): ReactElement {
  const { height, chartVariant, barColor, fillWindow } = shape
  const value = useMemo<ChartShape>(
    () =>
      height === undefined && chartVariant !== 'strip' && barColor === undefined
        ? NO_SHAPE
        : { height, strip: chartVariant === 'strip', barColor },
    [height, chartVariant, barColor]
  )
  const aggregate = useMemo(
    () =>
      chartAggregate === undefined || fillWindow === undefined
        ? chartAggregate
        : { ...chartAggregate, fillWindow },
    [chartAggregate, fillWindow]
  )
  return (
    <ChartShapeContext.Provider value={value}>
      <ChartCanvas
        {...canvas}
        chartAggregate={aggregate}
      />
    </ChartShapeContext.Provider>
  )
}
