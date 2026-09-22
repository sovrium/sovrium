/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import {
  computeChartLegendChipClasses,
  computeChartLegendChipSwatchClasses,
  computeChartLegendClasses,
} from '@/presentation/design/chart-default-classes'
import { seriesColor, type ChartSeriesConfig } from './chart-series-shared'
import type { ReactElement } from 'react'

// Both chip branches are resolved once at module load rather than per item, so a
// legend of N series allocates no class strings while rendering.
const CHIP_CLASSES = computeChartLegendChipClasses()
const CHIP_HIDDEN_CLASSES = computeChartLegendChipClasses({ hidden: true })
const SWATCH_CLASSES = computeChartLegendChipSwatchClasses()
const LEGEND_CLASSES = computeChartLegendClasses()
const LEGEND_COLUMN_CLASSES = computeChartLegendClasses({ column: true })

interface ChartLegendProps {
  readonly series: readonly ChartSeriesConfig[]
  readonly hidden: ReadonlySet<string>
  readonly onToggle: (field: string) => void
  /**
   * Stack the chips vertically instead of laying them out as a strip. Set when
   * the legend sits to the left or the right of the plot, where a horizontal
   * strip would be as wide as the card it is meant to sit beside.
   */
  readonly column?: boolean
}

/** A single legend entry — a series label, a colour swatch, and a click
 * target that toggles that series' visibility. */
function LegendItem({
  config,
  index,
  isHidden,
  onToggle,
}: {
  readonly config: ChartSeriesConfig
  readonly index: number
  readonly isHidden: boolean
  readonly onToggle: (field: string) => void
}): ReactElement {
  const label = config.label ?? config.field
  const color = seriesColor(config, index)
  const handleClick = useCallback(() => onToggle(config.field), [onToggle, config.field])
  return (
    <li className="chart-series-item">
      <button
        type="button"
        className={isHidden ? CHIP_HIDDEN_CLASSES : CHIP_CLASSES}
        data-legend-field={config.field}
        aria-pressed={!isHidden}
        onClick={handleClick}
      >
        <span
          className={SWATCH_CLASSES}
          data-legend-swatch={config.field}
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-series swatch colour is dynamic; React Compiler not yet enabled in Bun
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {label}
      </button>
    </li>
  )
}

/**
 * Interactive chart legend. Each item shows a series label and a colour
 * swatch; clicking an item toggles that series' visibility on the chart.
 *
 * The `chart-legend` class lets spec locators (`[class*="legend"]`) resolve.
 */
export function ChartLegend({
  series,
  hidden,
  onToggle,
  column = false,
}: ChartLegendProps): ReactElement {
  return (
    <ul
      className={`chart-legend ${column ? LEGEND_COLUMN_CLASSES : LEGEND_CLASSES}`}
      data-chart-legend="true"
    >
      {series.map((s, index) => (
        <LegendItem
          key={`legend-${s.field}`}
          config={s}
          index={index}
          isHidden={hidden.has(s.field)}
          onToggle={onToggle}
        />
      ))}
    </ul>
  )
}
