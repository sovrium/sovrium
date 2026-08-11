/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { seriesColor, type ChartSeriesConfig } from './chart-series-shared'
import type { ReactElement } from 'react'

interface ChartLegendProps {
  readonly series: readonly ChartSeriesConfig[]
  readonly hidden: ReadonlySet<string>
  readonly onToggle: (field: string) => void
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
        className={`flex items-center gap-1.5 ${isHidden ? 'opacity-40' : ''}`}
        data-legend-field={config.field}
        aria-pressed={!isHidden}
        onClick={handleClick}
      >
        <span
          className="inline-block size-3 rounded-sm"
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
export function ChartLegend({ series, hidden, onToggle }: ChartLegendProps): ReactElement {
  return (
    <ul
      className="chart-legend flex flex-wrap gap-3 px-2 py-1 text-sm"
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
