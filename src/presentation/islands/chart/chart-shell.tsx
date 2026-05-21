/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
  readonly children: (args: {
    readonly width: number
    readonly height: number
    readonly hidden: ReadonlySet<string>
  }) => ReactElement | undefined
}

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
