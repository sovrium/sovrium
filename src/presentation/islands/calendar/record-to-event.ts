/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveRecordColor } from '@/domain/kernel/color/record-color'
import { placeInZone } from './calendar-zone'
import type { TableRecord } from '../runtime/types'

/**
 * FullCalendar event shape consumed by the calendar component's `events` prop.
 *
 * We hand-roll the type rather than import `EventInput` from `@fullcalendar/react`
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
  /** The event's fill — FullCalendar 7 paints the chip and its border from it. */
  readonly color?: string
  /** Label tone, derived to meet WCAG AA against `color`. */
  readonly contrastColor?: string
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
 * `contrastColor` is DERIVED against the fill rather than assumed ([internal ref] A7
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
  return { color: colors.fill, contrastColor: colors.foreground, display: 'block' }
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
 * The end FullCalendar needs for a DAY end — the day after it.
 *
 * A `date` end is the LAST DAY the range covers — a leave from the 3rd to the
 * 17th includes the 17th — while FullCalendar reads an all-day end as
 * EXCLUSIVE. A `datetime` end is an instant and never reaches this.
 */
function dayAfter(day: string): string {
  const next = new Date(`${day}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

/** A day-valued field's value as the `YYYY-MM-DD` FullCalendar reads as all-day. */
const asDay = (value: string): string => value.slice(0, 10)

/**
 * An event's end as FullCalendar reads it: a day range drawn to its last day
 * included, a date-time placed at its zone's wall clock.
 */
const eventEnd = (
  stored: string | undefined,
  isDay: boolean,
  zone: () => string | undefined
): string | undefined => {
  if (!stored) return undefined
  return isDay ? dayAfter(asDay(stored)) : placeInZone(stored, zone())
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
    /** The fields holding a calendar day rather than an instant (server-resolved). */
    readonly dateOnlyFields?: readonly string[] | undefined
    /**
     * The zone a date-time field reads in — its declared `timeZone`, else the
     * operator zone — or `undefined` to leave it on the browser's clock.
     */
    readonly zoneOf?: ((field: string) => string | undefined) | undefined
  }
): readonly CalendarEvent[] {
  const { dateField, endDateField, labelField, colorField, colorFieldColors } = options
  const isDay = (field: string | undefined) =>
    field !== undefined && (options.dateOnlyFields?.includes(field) ?? false)
  if (!dateField) return []
  const zoneOf = (field: string | undefined) =>
    field === undefined ? undefined : options.zoneOf?.(field)

  return records
    .map((record): CalendarEvent | undefined => {
      const stored = readString(record, dateField)
      if (!stored) return undefined
      // A date-time is placed at its zone's wall clock, as the grid writes it.
      const start = isDay(dateField) ? asDay(stored) : placeInZone(stored, zoneOf(dateField))

      const end = eventEnd(readString(record, endDateField), isDay(endDateField), () =>
        zoneOf(endDateField)
      )
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
