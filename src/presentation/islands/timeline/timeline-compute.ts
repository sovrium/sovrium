/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'

export interface TimelineConfig {
  readonly startField: string
  readonly endField?: string
  readonly labelField?: string
  readonly groupBy?: string
  readonly colorField?: string
  readonly defaultZoom?: 'day' | 'week' | 'month' | 'quarter' | 'year'
}

export interface TimelineItem {
  readonly id: string
  readonly label: string
  readonly start: number
  readonly end?: number
  readonly kind: 'bar' | 'point'
  readonly colorValue?: string
  readonly group?: string
}

export interface TimelineLane {
  readonly key: string
  readonly items: readonly TimelineItem[]
}

function parseDate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const ms = new Date(String(value)).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

function readOptionalField(record: TableRecord, field: string | undefined): string | undefined {
  if (!field) return undefined
  const value = record[field]
  return value === undefined || value === null ? undefined : String(value)
}

function recordToTimelineItem(
  record: TableRecord,
  index: number,
  config: TimelineConfig
): TimelineItem | undefined {
  const start = parseDate(record[config.startField])
  if (start === undefined) return undefined

  const end = config.endField ? parseDate(record[config.endField]) : undefined
  const label =
    readOptionalField(record, config.labelField) ??
    String(record['id'] ?? `Item ${String(index + 1)}`)

  return {
    id: String(record['id'] ?? `timeline-item-${String(index)}`),
    label,
    start,
    end,
    kind: end !== undefined ? 'bar' : 'point',
    colorValue: readOptionalField(record, config.colorField),
    group: readOptionalField(record, config.groupBy),
  }
}

export function buildTimelineItems(
  records: readonly TableRecord[],
  config: TimelineConfig
): readonly TimelineItem[] {
  return records.flatMap((record, index) => {
    const item = recordToTimelineItem(record, index, config)
    return item ? [item] : []
  })
}

export function buildTimelineLanes(
  items: readonly TimelineItem[],
  groupBy: string | undefined
): readonly TimelineLane[] {
  if (!groupBy) return [{ key: '', items }]

  const order = items.reduce<readonly string[]>((acc, item) => {
    const key = item.group ?? ''
    return acc.includes(key) ? acc : [...acc, key]
  }, [])

  return order.map((key) => ({
    key,
    items: items.filter((item) => (item.group ?? '') === key),
  }))
}

export interface TimelineBounds {
  readonly min: number
  readonly max: number
}

export function computeTimelineBounds(items: readonly TimelineItem[]): TimelineBounds {
  if (items.length === 0) {
    const now = Date.now()
    return { min: now, max: now + 86_400_000 }
  }
  const starts = items.map((i) => i.start)
  const ends = items.map((i) => i.end ?? i.start)
  const min = Math.min(...starts)
  const max = Math.max(...ends)
  return min === max ? { min, max: max + 86_400_000 } : { min, max }
}

export function toPercent(value: number, bounds: TimelineBounds): number {
  const span = bounds.max - bounds.min
  if (span <= 0) return 0
  return ((value - bounds.min) / span) * 100
}
