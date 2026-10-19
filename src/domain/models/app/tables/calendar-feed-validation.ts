/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The table rules a `calendarFeed` must satisfy, judged with the table's
 * fields because the answer depends on them: each key must name a field of the
 * table, of a kind that can stand for that part of an event.
 */

/** The field kinds an event's start and end may be read from. */
export const CALENDAR_FEED_TIME_TYPES: ReadonlySet<string> = new Set(['date', 'datetime'])

/** The field kinds an event's title and notes may be read from. */
export const CALENDAR_FEED_TEXT_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'email',
  'url',
  'phone-number',
  'single-select',
  'status',
])

/** Shape of a table relevant to its calendar feed. */
interface TableForCalendarFeed {
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
  readonly calendarFeed?: {
    readonly start: string
    readonly end?: string
    readonly title: string
    readonly description?: string
  }
}

type ValidationError = { readonly message: string; readonly path: ReadonlyArray<string> }

type FeedKey = 'start' | 'end' | 'title' | 'description'

const KIND_LABEL: Readonly<Record<FeedKey, string>> = {
  start: 'a date or datetime field',
  end: 'a date or datetime field',
  title: 'a text, email, url, phone-number, single-select or status field',
  description: 'a text, email, url, phone-number, single-select or status field',
}

const acceptedTypes = (key: FeedKey): ReadonlySet<string> =>
  key === 'start' || key === 'end' ? CALENDAR_FEED_TIME_TYPES : CALENDAR_FEED_TEXT_TYPES

/** The problem with one key of the feed, or `undefined` when it names an acceptable field. */
const checkKey = (
  table: TableForCalendarFeed,
  key: FeedKey,
  name: string | undefined
): ValidationError | undefined => {
  if (name === undefined) return undefined
  const path = ['calendarFeed', key]
  const declared = table.fields.find((field) => field.name === name)
  if (declared === undefined) {
    return { message: `calendarFeed.${key} '${name}' names no field of the table`, path }
  }
  return acceptedTypes(key).has(declared.type)
    ? undefined
    : {
        message: `calendarFeed.${key} '${name}' is a ${declared.type} field; an event's ${key} is read from ${KIND_LABEL[key]}`,
        path,
      }
}

/** `end` must be the same kind as `start`: a day range or an instant range, never a mix. */
const checkEndMatchesStart = (table: TableForCalendarFeed): ValidationError | undefined => {
  const feed = table.calendarFeed
  if (feed?.end === undefined) return undefined
  const typeOf = (name: string) => table.fields.find((field) => field.name === name)?.type
  const startType = typeOf(feed.start)
  const endType = typeOf(feed.end)
  return startType === endType
    ? undefined
    : {
        message: `calendarFeed.end '${feed.end}' is a ${endType} field and calendarFeed.start '${feed.start}' a ${startType} field; an event starts and ends on fields of the same type`,
        path: ['calendarFeed', 'end'],
      }
}

/**
 * Every key of `calendarFeed` must name a field of the table of an accepted
 * kind, and `end` the same kind as `start`.
 *
 * @returns the first problem, or `undefined` when the table declares no feed
 *   or its feed is acceptable.
 */
export const validateCalendarFeed = (table: TableForCalendarFeed): ValidationError | undefined => {
  const feed = table.calendarFeed
  if (feed === undefined) return undefined
  return (
    checkKey(table, 'start', feed.start) ??
    checkKey(table, 'end', feed.end) ??
    checkKey(table, 'title', feed.title) ??
    checkKey(table, 'description', feed.description) ??
    checkEndMatchesStart(table)
  )
}
