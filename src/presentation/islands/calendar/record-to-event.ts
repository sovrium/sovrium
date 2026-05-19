/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'

export interface CalendarEvent {
  readonly id: string
  readonly title: string
  readonly start: string
  readonly end?: string
  readonly allDay?: boolean
  readonly backgroundColor?: string
  readonly borderColor?: string
  readonly extendedProps?: TableRecord
}

const COLOR_PALETTE: readonly string[] = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
] as const

function hashStringToIndex(value: string, modulo: number): number {
  const initialHash = 2_166_136_261
  const hash = Array.from(value).reduce(
    (acc, ch) => Math.imul(acc ^ ch.charCodeAt(0), 16_777_619),
    initialHash
  )
  return Math.abs(hash) % modulo
}

function colorForValue(value: string): string {
  const palette = COLOR_PALETTE
  const index = hashStringToIndex(value, palette.length)
  return palette[index] ?? palette[0] ?? '#3b82f6'
}

function readString(record: TableRecord, field: string | undefined): string | undefined {
  if (!field) return undefined
  const value = record[field]
  if (value === null || value === undefined) return undefined
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function recordsToCalendarEvents(
  records: readonly TableRecord[],
  options: {
    readonly dateField: string | undefined
    readonly endDateField?: string | undefined
    readonly labelField?: string | undefined
    readonly colorField?: string | undefined
  }
): readonly CalendarEvent[] {
  const { dateField, endDateField, labelField, colorField } = options
  if (!dateField) return []

  return records
    .map((record): CalendarEvent | undefined => {
      const start = readString(record, dateField)
      if (!start) return undefined

      const end = readString(record, endDateField)
      const titleField = labelField ?? 'title'
      const title = readString(record, titleField) ?? ''

      const idValue = record['id']
      const id =
        idValue !== null && idValue !== undefined
          ? String(idValue)
          : `${start}-${title}`.replace(/\s+/g, '-')

      const colorValue = readString(record, colorField)
      const colorOverride = colorValue
        ? { backgroundColor: colorForValue(colorValue), borderColor: colorForValue(colorValue) }
        : {}

      const base = end ? { id, title, start, end } : { id, title, start }
      return { ...base, ...colorOverride, extendedProps: record }
    })
    .filter((event): event is CalendarEvent => event !== undefined)
}
