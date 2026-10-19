/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How `calendar/importIcs` turns an iCalendar event into the values of a row:
 * which field each event property goes to, how a time is written to a `date`
 * or a `datetime` field, which events are skipped, and whether a stored row
 * already holds an event's values (in which case it is not written).
 *
 * Reads the target table structurally — its field names and types, and its
 * `calendarFeed` — so this module depends on no other property of the app.
 */

import { shiftDay, type IcsTime } from '@/domain/kernel/format/icalendar'
import { dayInZone, type IcsReadEvent } from '@/domain/kernel/format/icalendar-reader'

/** The event properties a `map` may name. */
export const IMPORT_ICS_PROPERTIES = [
  'summary',
  'description',
  'location',
  'start',
  'end',
  'url',
  'status',
] as const

export type ImportIcsProperty = (typeof IMPORT_ICS_PROPERTIES)[number]

/** Which field each event property is written to. */
export type ImportIcsMap = Readonly<Partial<Record<ImportIcsProperty, string>>>

/** The shape of the target table this module reads. */
export interface ImportIcsTable {
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
  readonly calendarFeed?: {
    readonly start: string
    readonly end?: string | undefined
    readonly title: string
    readonly description?: string | undefined
  }
}

/** The table's own `calendarFeed`, read backwards, as an import map. */
const feedMapOf = (table: ImportIcsTable): ImportIcsMap => {
  const feed = table.calendarFeed
  if (feed === undefined) return {}
  return {
    summary: feed.title,
    start: feed.start,
    ...(feed.end === undefined ? {} : { end: feed.end }),
    ...(feed.description === undefined ? {} : { description: feed.description }),
  }
}

/**
 * The map an import follows: the table's `calendarFeed` read backwards, each
 * key of the step's own `map` overriding or adding to it.
 */
export const resolveImportMap = (
  table: ImportIcsTable,
  map: Readonly<Record<string, unknown>> | undefined
): ImportIcsMap => {
  const own = Object.fromEntries(
    IMPORT_ICS_PROPERTIES.flatMap((key) => {
      const field = map?.[key]
      return typeof field === 'string' && field !== '' ? [[key, field]] : []
    })
  ) as ImportIcsMap
  return { ...feedMapOf(table), ...own }
}

/** Why an event is not imported, or `undefined` when it is. */
export const importSkipReason = (
  event: IcsReadEvent,
  map: ImportIcsMap
): 'no-uid' | 'occurrence-override' | 'cancelled' | undefined => {
  if (event.uid === undefined || event.uid.trim() === '') return 'no-uid'
  if (event.overridesOccurrence) return 'occurrence-override'
  if (event.status === 'CANCELLED' && map.status === undefined) return 'cancelled'
  return undefined
}

/** The value a time takes in a field of `fieldType`. */
const timeValue = (time: IcsTime, fieldType: string | undefined, isEnd: boolean): string => {
  if (fieldType === 'date') {
    if (time.kind === 'date') return isEnd ? shiftDay(time.date, -1) : time.date
    return dayInZone(time.epochMs, time.timeZone ?? 'UTC')
  }
  if (time.kind === 'date') {
    return new Date(`${isEnd ? shiftDay(time.date, -1) : time.date}T00:00:00.000Z`).toISOString()
  }
  return new Date(time.epochMs).toISOString()
}

/** The event's value for one property, `undefined` when the event does not carry it. */
const propertyValue = (
  event: IcsReadEvent,
  key: ImportIcsProperty,
  fieldType: string | undefined
): string | undefined => {
  if (key === 'start') return timeValue(event.start, fieldType, false)
  if (key === 'end')
    return event.end === undefined ? undefined : timeValue(event.end, fieldType, true)
  const value = event[key]
  return value === '' ? undefined : value
}

/**
 * The values of the row an event becomes, keyed by field name: every mapped
 * property, `undefined` where the event does not carry it (the field is
 * then cleared). Unmapped properties are
 * not written.
 */
export const eventRowValues = (
  event: IcsReadEvent,
  map: ImportIcsMap,
  table: ImportIcsTable
): Readonly<Record<string, string | undefined>> => {
  const typeOf = (name: string) => table.fields.find((field) => field.name === name)?.type
  return Object.fromEntries(
    IMPORT_ICS_PROPERTIES.flatMap((key) => {
      const field = map[key]
      return field === undefined ? [] : [[field, propertyValue(event, key, typeOf(field))]]
    })
  )
}

/** A stored value as the import compares it: a day, an instant, or text; empty is `undefined`. */
const comparable = (value: unknown, fieldType: string | undefined): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  if (fieldType === 'date') {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
  }
  if (fieldType === 'datetime') {
    const instant = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(instant.getTime()) ? String(value) : instant.toISOString()
  }
  return String(value)
}

/** Whether `stored` already holds every one of `values`, so the row need not be written. */
export const rowHoldsValues = (
  stored: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, string | undefined>>,
  table: ImportIcsTable
): boolean =>
  Object.entries(values).every(([field, value]) => {
    const type = table.fields.find((declared) => declared.name === field)?.type
    return comparable(stored[field], type) === comparable(value, type)
  })
