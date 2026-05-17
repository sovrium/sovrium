/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'

/**
 * FullCalendar event shape consumed by the calendar component's `events` prop.
 *
 * We hand-roll the type rather than import `EventInput` from `@fullcalendar/core`
 * to keep this module free of FullCalendar runtime imports — the calendar
 * island lazy-loads the FullCalendar bundle, but this mapper runs eagerly
 * during prop preparation.
 */
export interface CalendarEvent {
  readonly id: string
  readonly title: string
  readonly start: string
  readonly end?: string
  readonly allDay?: boolean
  readonly backgroundColor?: string
  readonly borderColor?: string
  /**
   * Full record snapshot exposed via FullCalendar's `extendedProps`. Lets
   * `eventClick` handlers resolve `$record.X` tokens in navigate paths
   * without round-tripping back to the server for the underlying record.
   */
  readonly extendedProps?: TableRecord
}

/**
 * Deterministic palette for `colorField` value→color mapping.
 *
 * Mirrors kanban's approach: a distinct value gets a distinct hue so users
 * can visually group events by category/status. Hashing keeps the mapping
 * stable across renders without requiring a sorted enumeration of values.
 */
const COLOR_PALETTE: readonly string[] = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
] as const

function hashStringToIndex(value: string, modulo: number): number {
  // FNV-1a-style hash — fast, stable, no crypto dependency.
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
  // Non-empty palette: index is bounded; fallback keeps types non-undefined.
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

/**
 * Maps a list of table records into FullCalendar-compatible event objects.
 *
 * Records without a value at `dateField` are dropped — they have no calendar
 * position. The optional `endDateField` enables multi-day events; when only a
 * start date is provided, FullCalendar treats the event as a single-day event.
 *
 * The optional `labelField` overrides the default title source (the `title`
 * column or first record field). The optional `idField` defaults to `'id'`
 * which matches Sovrium's auto-generated primary key column.
 */
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
