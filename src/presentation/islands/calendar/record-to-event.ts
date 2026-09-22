/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRecordColor } from '@/domain/kernel/color/record-color'
import type { TableRecord } from '../runtime/types'

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
  /** Label tone, derived to meet WCAG AA against `backgroundColor`. */
  readonly textColor?: string
  /**
   * FullCalendar's per-event render mode.
   *
   * Forced to `'block'` for a coloured event because month view renders a
   * TIMED event as a dot by default: the harness stays transparent and the hue
   * only tints a 6px dot, so an author's declared `colorField` colour was
   * effectively invisible on the default surface. Left absent otherwise, so an
   * uncoloured calendar keeps FullCalendar's own `'auto'` behaviour.
   */
  readonly display?: string
  /**
   * Full record snapshot exposed via FullCalendar's `extendedProps`. Lets
   * `eventClick` handlers resolve `$record.X` tokens in navigate paths
   * without round-tripping back to the server for the underlying record.
   */
  readonly extendedProps?: TableRecord
}

/**
 * Fallback palette for a `colorField` whose options declare no colour — the
 * platform chart series, so a calendar and a chart of the same data categorise
 * it in the same hues instead of two unrelated sets.
 *
 * A distinct value gets a distinct hue so users can visually group events by
 * category/status. The value is HASHED onto it (see `resolveRecordColor`), so
 * the mapping is stable across renders and independent of which other records
 * happen to be in view.
 *
 * These are LITERAL hexes rather than `var(--sv-chart-N)`, and that is forced
 * rather than chosen: every entry is fed to `deriveOptionChipColors`, which
 * computes a WCAG-AA foreground and a border by parsing the value as
 * `#RRGGBB`. It returns `undefined` for anything it cannot parse, so a `var()`
 * here would not fall back to the token — it would silently drop the colour
 * from every event. Keep these in step with `--sv-chart-1..5`.
 */
const COLOR_PALETTE: readonly string[] = [
  '#398ad6', // blue
  '#cd5f62', // red
  '#479c4d', // green
  '#b67700', // amber
  '#9470cd', // violet
] as const

/**
 * The colour overlay for one record's `colorField` value: the author's declared
 * option colour when the field declares one, otherwise the hashed fallback.
 *
 * `textColor` is DERIVED against the fill rather than assumed ([internal ref] A7
 * ruling 3) — an author may declare a fill anywhere in sRGB, and FullCalendar's
 * built-in white event text is unreadable over a pale one.
 */
function colorOverlayFor(
  value: string | undefined,
  optionColors: Readonly<Record<string, string>> | undefined
): Partial<CalendarEvent> {
  if (!value) return {}
  const colors = resolveRecordColor(value, optionColors, COLOR_PALETTE)
  if (!colors) return {}
  return {
    backgroundColor: colors.fill,
    borderColor: colors.border,
    textColor: colors.foreground,
    display: 'block',
  }
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
    /** `optionValue → #RRGGBB` declared on `colorField`; absent when it declares none. */
    readonly colorFieldColors?: Readonly<Record<string, string>> | undefined
  }
): readonly CalendarEvent[] {
  const { dateField, endDateField, labelField, colorField, colorFieldColors } = options
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

      const colorOverride = colorOverlayFor(readString(record, colorField), colorFieldColors)

      const base = end ? { id, title, start, end } : { id, title, start }
      return { ...base, ...colorOverride, extendedProps: record }
    })
    .filter((event): event is CalendarEvent => event !== undefined)
}
