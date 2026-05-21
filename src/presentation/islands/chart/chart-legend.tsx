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
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {label}
      </button>
    </li>
  )
}

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
