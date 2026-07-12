/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type AggregateFunction, reduceAggregate } from '../shared/aggregate-functions'
import type { TableRecord } from '../shared/types'


export type KpiAggregateFunction = AggregateFunction

export interface KpiAggregateConfig {
  readonly function: KpiAggregateFunction
  readonly field?: string
}

export type KpiFormatType = 'number' | 'currency' | 'percentage' | 'compact' | 'bytes'

export interface KpiFormatConfig {
  readonly type: KpiFormatType
  readonly options?: Readonly<Record<string, string>>
}

export function aggregateKpi(records: readonly TableRecord[], config: KpiAggregateConfig): number {
  if (config.function === 'count') return records.length

  if (!config.field) return 0

  const { field } = config
  const values = records.map((record) => Number(record[field])).filter((n) => Number.isFinite(n))

  return reduceAggregate(config.function, values)
}

export function formatKpiValue(value: number, format: KpiFormatConfig | undefined): string {
  if (!format || format.type === 'number') {
    return new Intl.NumberFormat('en-US').format(value)
  }

  if (format.type === 'currency') {
    const currency = format.options?.currency ?? 'USD'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  }

  if (format.type === 'percentage') {
    return formatPercentage(value, format.options?.scale)
  }

  if (format.type === 'bytes') {
    return formatBytes(value)
  }

  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
}

function formatPercentage(value: number, scaleOption: string | undefined): string {
  const scale = Number(scaleOption)
  const display = Number.isFinite(scale) && scale !== 0 ? Math.round(value * scale) : value
  return `${new Intl.NumberFormat('en-US').format(display)}%`
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 o'
  if (bytes < 1024) return `${String(bytes)} o`
  if (bytes < 1024 * 1024) return `${String(Math.round(bytes / 1024))} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${String(Math.round(bytes / (1024 * 1024)))} Mo`
  return `${String(Math.round(bytes / (1024 * 1024 * 1024)))} Go`
}

export interface KpiThresholdConfig {
  readonly value: number
  readonly color: string
}

export function resolveKpiThresholdColor(
  value: number,
  thresholds: readonly KpiThresholdConfig[] | undefined
): string | undefined {
  if (!thresholds || thresholds.length === 0) return undefined

  const sorted = thresholds.toSorted((a, b) => a.value - b.value)
  const met = sorted.filter((t) => value >= t.value)

  if (met.length > 0) return met[met.length - 1]?.color
  return sorted[0]?.color
}

export interface KpiSparklineConfig {
  readonly field: string
  readonly groupBy: string
  readonly interval: 'day' | 'week' | 'month'
  readonly days: number
}

function dayKey(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined
  const date = new Date(raw as string | number | Date)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

export function computeSparklineSeries(
  records: readonly TableRecord[],
  config: KpiSparklineConfig
): readonly number[] {
  const points = records
    .map((record) => ({
      day: dayKey(record[config.groupBy]),
      value: Number(record[config.field]),
    }))
    .filter((p): p is { day: string; value: number } => Boolean(p.day) && Number.isFinite(p.value))

  const buckets = points.reduce<Readonly<Record<string, number>>>(
    (acc, point) => ({ ...acc, [point.day]: (acc[point.day] ?? 0) + point.value }),
    {}
  )

  return Object.keys(buckets)
    .toSorted((a, b) => a.localeCompare(b))
    .map((day) => buckets[day] ?? 0)
}
