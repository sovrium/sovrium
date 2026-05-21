/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type AggregateFunction, reduceAggregate } from '../shared/aggregate-functions'
import type { TableRecord } from '../shared/types'


export type DateInterval = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface ChartAggregateConfig {
  readonly function: AggregateFunction
  readonly field?: string
  readonly groupBy: string
  readonly interval?: DateInterval
}

export interface AggregatedDatum {
  readonly key: string
  readonly value: number
}

function bucketDate(raw: unknown, interval: DateInterval): string {
  const date = new Date(String(raw))
  if (Number.isNaN(date.getTime())) return String(raw)

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  const pad = (n: number): string => String(n).padStart(2, '0')

  if (interval === 'year') return String(year)
  if (interval === 'quarter') return `${String(year)}-Q${String(Math.ceil(month / 3))}`
  if (interval === 'month') return `${String(year)}-${pad(month)}`
  if (interval === 'week') {
    const anchor = new Date(Date.UTC(year, date.getUTCMonth(), day))
    const dayOfWeek = (anchor.getUTCDay() + 6) % 7
    anchor.setUTCDate(anchor.getUTCDate() - dayOfWeek)
    return `${String(anchor.getUTCFullYear())}-${pad(anchor.getUTCMonth() + 1)}-${pad(
      anchor.getUTCDate()
    )}`
  }
  return `${String(year)}-${pad(month)}-${pad(day)}`
}

function groupKey(record: TableRecord, config: ChartAggregateConfig): string | undefined {
  const raw = record[config.groupBy]
  if (raw === undefined || raw === null) return undefined
  return config.interval ? bucketDate(raw, config.interval) : String(raw)
}

export function aggregateRecords(
  records: readonly TableRecord[],
  config: ChartAggregateConfig
): readonly AggregatedDatum[] {
  const buckets = records.reduce<Readonly<Record<string, readonly number[]>>>((acc, record) => {
    const key = groupKey(record, config)
    if (key === undefined) return acc

    if (config.function === 'count') {
      return { ...acc, [key]: [...(acc[key] ?? []), 1] }
    }

    if (!config.field) return acc
    const numeric = Number(record[config.field])
    if (!Number.isFinite(numeric)) return acc
    return { ...acc, [key]: [...(acc[key] ?? []), numeric] }
  }, {})

  return Object.keys(buckets)
    .toSorted((a, b) => a.localeCompare(b))
    .map((key) => ({ key, value: reduceAggregate(config.function, buckets[key] ?? []) }))
}
