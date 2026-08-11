/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared layout shell for the multi-series chart family. Renders the
 * `data-component="chart"` container, the optional interactive legend, and
 * a `ParentSize`-measured body that delegates SVG rendering to a
 * per-chart-type `renderSvg` callback.
 *
 * Hidden-series state lives here because the legend and the SVG both need
 * it — keeping it in one place removes the identical `useState` +
 * `handleToggle` block previously copied into every chart canvas.
 */

import { ParentSize } from '@visx/responsive'
import { useCallback, useState } from 'react'
import { ChartLegend } from './chart-legend'
import {
  CHART_BODY_CLASSES,
  CHART_CONTAINER_CLASSES,
  toggleHidden,
  type ChartSeriesConfig,
  type LegendPosition,
} from './chart-series-shared'
import type { ReactElement } from 'react'

interface ChartShellProps {
  readonly series: readonly ChartSeriesConfig[]
  readonly legendPosition?: LegendPosition
  readonly legendVisible?: boolean
  /**
   * Render-prop that draws the chart SVG for a measured viewport with the
   * current hidden-series set. Returning `undefined` (e.g. a zero-size
   * viewport) skips rendering. Passed as `children` so an inline arrow
   * does not trip `react-perf/jsx-no-new-function-as-prop`.
   */
  readonly children: (args: {
    readonly width: number
    readonly height: number
    readonly hidden: ReadonlySet<string>
  }) => ReactElement | undefined
}

/**
 * Multi-series chart shell — owns the legend visibility toggle and the
 * responsive measuring wrapper. Each chart canvas supplies only its own
 * SVG via the `children` render-prop.
 */
export function ChartShell({
  series,
  legendPosition,
  legendVisible,
  children,
}: ChartShellProps): ReactElement {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set<string>())
  const showLegend = legendVisible !== false && legendPosition !== 'none'

  const handleToggle = useCallback((field: string) => {
    setHidden((prev) => toggleHidden(prev, field))
  }, [])

  return (
    <div
      data-component="chart"
      className={CHART_CONTAINER_CLASSES}
    >
      {showLegend ? (
        <ChartLegend
          series={series}
          hidden={hidden}
          onToggle={handleToggle}
        />
      ) : undefined}
      <div className={CHART_BODY_CLASSES}>
        <ParentSize>
          {({ width, height }) => {
            if (width <= 0 || height <= 0) return undefined
            return children({ width, height, hidden })
          }}
        </ParentSize>
      </div>
    </div>
  )
}
