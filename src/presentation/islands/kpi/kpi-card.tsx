/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveLucideIcon } from '@/presentation/utils/lucide-resolver'
import { KpiSparkline } from './kpi-sparkline'
import type { ReactElement } from 'react'

export interface KpiTrendConfig {
  readonly comparisonPeriod?: string
  readonly direction?: 'up' | 'down' | 'flat'
  readonly changePercent: number
  readonly color?: 'green' | 'red' | 'yellow' | 'gray'
}

interface KpiCardProps {
  readonly label?: string
  readonly value: string
  readonly icon?: string
  readonly trend?: KpiTrendConfig
  readonly thresholdColor?: string
  readonly sparklineSeries?: readonly number[]
}

const THRESHOLD_COLOR_CLASS: Record<string, string> = {
  red: 'text-error-fg',
  green: 'text-success-fg',
  yellow: 'text-warning-fg',
  blue: 'text-primary',
  gray: 'text-foreground-muted',
}

const TREND_COLOR_CLASS: Record<NonNullable<KpiTrendConfig['color']>, string> = {
  green: 'text-success-fg',
  red: 'text-error-fg',
  yellow: 'text-warning-fg',
  gray: 'text-foreground-muted',
}

const TREND_DIRECTION_ARROW: Record<NonNullable<KpiTrendConfig['direction']>, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

function KpiTrend({ trend }: { readonly trend: KpiTrendConfig }): ReactElement {
  const colorClass = TREND_COLOR_CLASS[trend.color ?? 'gray']
  const arrow = TREND_DIRECTION_ARROW[trend.direction ?? 'flat']

  return (
    <div
      data-role="kpi-trend"
      className={`mt-1 flex items-center gap-1 text-sm font-medium ${colorClass}`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{`${String(trend.changePercent)}%`}</span>
    </div>
  )
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  thresholdColor,
  sparklineSeries,
}: KpiCardProps): ReactElement {
  const Icon = resolveLucideIcon(icon)
  const valueColorClass = thresholdColor
    ? (THRESHOLD_COLOR_CLASS[thresholdColor] ?? 'text-foreground')
    : 'text-foreground'

  return (
    <div
      data-component="kpi"
      data-kpi-state="ready"
      className="border-border bg-background-raised flex flex-col rounded-lg border p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <span
            data-role="kpi-icon"
            className="text-foreground-subtle"
          >
            <Icon
              width={20}
              height={20}
              aria-hidden="true"
            />
          </span>
        )}
        {label && (
          <span
            data-role="kpi-label"
            className="text-foreground-muted text-sm font-medium"
          >
            {label}
          </span>
        )}
      </div>
      <div
        data-role="kpi-value"
        {...(thresholdColor ? { 'data-threshold': thresholdColor } : {})}
        className={`mt-1 text-3xl font-bold ${valueColorClass}`}
      >
        {value}
      </div>
      {trend && <KpiTrend trend={trend} />}
      {sparklineSeries && sparklineSeries.length > 0 && <KpiSparkline series={sparklineSeries} />}
    </div>
  )
}
