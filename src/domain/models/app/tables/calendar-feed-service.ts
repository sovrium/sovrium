/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How one row of a table becomes one event of its calendar feed
 * (`tables[].calendarFeed`), mirroring how the event-calendar component places
 * a row: no start, no event; a `date` start is an all-day event whose
 * exclusive end is the day after its last day; a `datetime` start is a timed
 * event, written in UTC. A field the reader may not read is simply absent from
 * the row handed in, so it is absent from the event too.
 */

import { nextDay, type IcsTime, type IcsWriteEvent } from '@/domain/kernel/format/icalendar'

/** The feed keys, as the table declares them. */
export interface CalendarFeedFields {
  readonly start: string
  readonly end?: string | undefined
  readonly title: string
  readonly description?: string | undefined
}

/** The most events one feed carries — the latest-starting ones. */
export const CALENDAR_FEED_MAX_EVENTS = 5000

/** One row as the records list returned it to the reader. */
export interface CalendarFeedRow {
  readonly id: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly updatedAt: string
}

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === ''

/** A stored day value as `YYYY-MM-DD`, or `undefined` when it names no day. */
const dayOf = (value: unknown): string | undefined => {
  if (isEmpty(value)) return undefined
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10)
  }
  const text = String(value)
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : undefined
}

/** A stored instant as epoch milliseconds, or `undefined` when it names none. */
const instantOf = (value: unknown): number | undefined => {
  if (isEmpty(value)) return undefined
  const ms = value instanceof Date ? value.getTime() : new Date(String(value)).getTime()
  return Number.isNaN(ms) ? undefined : ms
}

/** The event's start and exclusive end, read from fields of `kind`. */
const timesOf = (
  kind: 'date' | 'datetime',
  start: unknown,
  end: unknown
): { readonly start: IcsTime; readonly end?: IcsTime } | undefined => {
  if (kind === 'date') {
    const first = dayOf(start)
    if (first === undefined) return undefined
    const last = dayOf(end)
    // A last day before the first reads as a one-day event, never a negative span.
    const lastDay = last !== undefined && last >= first ? last : first
    return { start: { kind: 'date', date: first }, end: { kind: 'date', date: nextDay(lastDay) } }
  }
  const startMs = instantOf(start)
  if (startMs === undefined) return undefined
  const endMs = instantOf(end)
  return endMs === undefined || endMs < startMs
    ? { start: { kind: 'date-time', epochMs: startMs } }
    : { start: { kind: 'date-time', epochMs: startMs }, end: { kind: 'date-time', epochMs: endMs } }
}

const textOf = (value: unknown): string | undefined => (isEmpty(value) ? undefined : String(value))

/** The stable UID of a row's event: `{table}-{recordId}@{host}`. */
export const calendarFeedUid = (tableName: string, recordId: string, host: string): string =>
  `${tableName}-${recordId}@${host}`

/**
 * The event a row stands for, or `undefined` when it has no readable start.
 * `startKind` is the type of the `start` field (`date` or `datetime`).
 */
export const rowToCalendarEvent = (input: {
  readonly row: CalendarFeedRow
  readonly feed: CalendarFeedFields
  readonly startKind: 'date' | 'datetime'
  readonly tableName: string
  readonly host: string
}): IcsWriteEvent | undefined => {
  const { row, feed } = input
  const times = timesOf(
    input.startKind,
    row.fields[feed.start],
    feed.end === undefined ? undefined : row.fields[feed.end]
  )
  if (times === undefined) return undefined
  const stamp = instantOf(row.updatedAt) ?? 0
  return {
    uid: calendarFeedUid(input.tableName, row.id, input.host),
    stampMs: stamp,
    ...times,
    summary: textOf(row.fields[feed.title]),
    description: feed.description === undefined ? undefined : textOf(row.fields[feed.description]),
  }
}
