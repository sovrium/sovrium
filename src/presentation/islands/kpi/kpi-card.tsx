/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as LucideIcons from 'lucide-react'
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
  red: 'text-red-600',
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
  gray: 'text-gray-600',
}

function kebabToPascalCase(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function resolveLucideIcon(
  iconName: string | undefined
): React.ComponentType<Record<string, unknown>> | undefined {
  if (!iconName) return undefined
  const component = (LucideIcons as Record<string, unknown>)[kebabToPascalCase(iconName)]
  if (typeof component === 'function')
    return component as React.ComponentType<Record<string, unknown>>
  if (typeof component === 'object' && component !== null)
    return component as React.ComponentType<Record<string, unknown>>
  return undefined
}

const TREND_COLOR_CLASS: Record<NonNullable<KpiTrendConfig['color']>, string> = {
  green: 'text-green-600',
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  gray: 'text-gray-500',
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
    ? (THRESHOLD_COLOR_CLASS[thresholdColor] ?? 'text-gray-900')
    : 'text-gray-900'

  return (
    <div
      data-component="kpi"
      data-kpi-state="ready"
      className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <span
            data-role="kpi-icon"
            className="text-gray-400"
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
            className="text-sm font-medium text-gray-500"
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
