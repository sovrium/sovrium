/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { TableRecord } from '../shared/types'

export interface ChartSeriesConfig {
  readonly field: string
  readonly label?: string
  readonly color?: string
  readonly stack?: string
  readonly fillOpacity?: number
}

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none'

const SERIES_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'] as const

export function seriesColor(s: ChartSeriesConfig, index: number): string {
  return s.color ?? SERIES_COLORS[index % SERIES_COLORS.length] ?? '#3b82f6'
}

export const CHART_MARGIN = { top: 16, right: 16, bottom: 40, left: 56 } as const

export const CHART_CONTAINER_CLASSES = 'relative w-full h-80'
export const CHART_BODY_CLASSES = 'relative h-72 w-full'

export function numericValue(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function xKeys(records: readonly TableRecord[], xField: string): readonly string[] {
  return records.reduce<readonly string[]>((acc, r) => {
    const raw = r[xField]
    if (raw === undefined || raw === null) return acc
    const key = String(raw)
    return acc.includes(key) ? acc : [...acc, key]
  }, [])
}

export function maxAcrossSeries(
  records: readonly TableRecord[],
  series: readonly ChartSeriesConfig[]
): number {
  return series.reduce((max, s) => {
    const seriesMax = records.reduce((m, r) => {
      const v = numericValue(r[s.field])
      return v > m ? v : m
    }, 0)
    return seriesMax > max ? seriesMax : max
  }, 0)
}

export function toggleHidden(prev: ReadonlySet<string>, field: string): ReadonlySet<string> {
  const remaining = [...prev].filter((f) => f !== field)
  return prev.has(field) ? new Set(remaining) : new Set([...prev, field])
}
