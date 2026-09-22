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
 *
 * `legend.position` is honoured here, and it is a PLACEMENT: which of the plot's
 * four edges the strip occupies. The shell used to read it as a single bit —
 * `none` or not — and draw every legend above the body, so `bottom`, `left` and
 * `right` were three values that rendered as `top`. An absent position still
 * means `top`, which is the behaviour that shipped.
 */

import { ParentSize } from '@visx/responsive'
import { useCallback, useState } from 'react'
import {
  computeChartBodyClasses,
  computeChartLayoutClasses,
  computeChartShellClasses,
} from '@/presentation/design/chart-default-classes'
import { ChartLegend } from './chart-legend'
import { toggleHidden, type ChartSeriesConfig, type LegendPosition } from './chart-series-shared'
import type { ReactElement } from 'react'

// Resolved once at module load: the recipes are pure, so re-computing them per
// render would allocate a string on every measure pass of a chart that
// re-measures on every resize. Both forms of each are precomputed rather than
// selected lazily, since a chart's placement never changes after mount.
const SHELL_CLASSES = computeChartShellClasses()
const BODY_CLASSES = computeChartBodyClasses()
const BODY_BESIDE_CLASSES = computeChartBodyClasses({ beside: true })
const LAYOUT_CLASSES = computeChartLayoutClasses()
const LAYOUT_BESIDE_CLASSES = computeChartLayoutClasses({ beside: true })

/** The two placements that put the legend on a side rather than above or below. */
const isBesidePosition = (position: LegendPosition | undefined): boolean =>
  position === 'left' || position === 'right'

/**
 * Does the legend come BEFORE the plot in reading order? `top` and `left` do,
 * and so does an absent position — the shell has always drawn the legend first,
 * and only the two trailing placements move it after the body.
 */
const isLegendFirst = (position: LegendPosition | undefined): boolean =>
  position !== 'bottom' && position !== 'right'

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
 * The measured interior the SVG draws into.
 *
 * `data-chart-body` marks it. That is identity rather than paint, exactly like
 * `data-chart-legend` on the strip: a placement can only be asserted against
 * the box the legend is placed RELATIVE TO, and without a hook on this element
 * there is nothing to compare a legend against.
 */
function ChartBody({
  beside,
  hidden,
  children,
}: {
  readonly beside: boolean
  readonly hidden: ReadonlySet<string>
  readonly children: ChartShellProps['children']
}): ReactElement {
  return (
    <div
      data-chart-body="true"
      className={beside ? BODY_BESIDE_CLASSES : BODY_CLASSES}
    >
      <ParentSize>
        {({ width, height }) => {
          if (width <= 0 || height <= 0) return undefined
          return children({ width, height, hidden })
        }}
      </ParentSize>
    </div>
  )
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
  const beside = isBesidePosition(legendPosition)

  const handleToggle = useCallback((field: string) => {
    setHidden((prev) => toggleHidden(prev, field))
  }, [])

  const legend = showLegend ? (
    <ChartLegend
      series={series}
      hidden={hidden}
      onToggle={handleToggle}
      column={beside}
    />
  ) : undefined

  const body = (
    <ChartBody
      beside={beside}
      hidden={hidden}
    >
      {children}
    </ChartBody>
  )

  return (
    <div
      data-component="chart"
      className={SHELL_CLASSES}
    >
      <div className={beside ? LAYOUT_BESIDE_CLASSES : LAYOUT_CLASSES}>
        {isLegendFirst(legendPosition) ? (
          <>
            {legend}
            {body}
          </>
        ) : (
          <>
            {body}
            {legend}
          </>
        )}
      </div>
    </div>
  )
}
