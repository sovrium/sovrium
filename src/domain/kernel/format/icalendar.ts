/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The iCalendar (RFC 5545) subset Sovrium speaks: a writer for the calendar
 * feed a table publishes here, and a reader for the feeds `calendar/importIcs`
 * imports in `icalendar-reader.ts`. Pure, dependency-free, and deliberately small — no recurrence
 * expansion, no `VTIMEZONE` rules, no attendees. A date-time is written in UTC;
 * a zoned one is read through `Intl`, which already knows the IANA zones.
 *
 * A day is carried as `YYYY-MM-DD` and an instant as epoch milliseconds, so a
 * caller never hands this module a `Date` whose zone is ambiguous.
 */

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** A whole day, `YYYY-MM-DD`. */
export interface IcsDay {
  readonly kind: 'date'
  readonly date: string
}

/** An instant, with the zone its wall clock was read in when one was named. */
export interface IcsInstant {
  readonly kind: 'date-time'
  readonly epochMs: number
  /** The IANA zone the value was written in (`UTC` for a trailing `Z`). */
  readonly timeZone?: string
}

export type IcsTime = IcsDay | IcsInstant

/** The day after `date` (`YYYY-MM-DD`), across months and years. */
export const nextDay = (date: string): string => shiftDay(date, 1)

/**
 * `date` (`YYYY-MM-DD`) moved by `days`. The year is set on its own, since
 * `Date.UTC` reads a year below 100 as 19xx.
 */
export const shiftDay = (date: string, days: number): string => {
  const [year, month, day] = date.split('-').map(Number)
  const at = new Date(0)
  const ms = at.setUTCFullYear(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days)
  return new Date(ms).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

/** One event of a published calendar. */
export interface IcsWriteEvent {
  readonly uid: string
  /** When the event was last changed; written as both `DTSTAMP` and `LAST-MODIFIED`. */
  readonly stampMs: number
  readonly start: IcsTime
  /** The exclusive end, of the same kind as `start`. */
  readonly end?: IcsTime | undefined
  readonly summary?: string | undefined
  readonly description?: string | undefined
}

/** A published calendar. */
export interface IcsWriteCalendar {
  readonly name: string
  readonly events: readonly IcsWriteEvent[]
}

const CRLF = '\r\n'
const MAX_LINE_OCTETS = 75

/** TEXT escaping (RFC 5545 §3.3.11): backslash, semicolon, comma, and every line break. */
export const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')

/** The UTF-8 octets of one code point, read off its value. */
const utf8Length = (codePoint: string): number => {
  const value = codePoint.codePointAt(0) ?? 0
  if (value < 0x80) return 1
  if (value < 0x8_00) return 2
  return value < 0x1_00_00 ? 3 : 4
}

/**
 * Fold a content line at 75 octets (RFC 5545 §3.1): CRLF then one space, the
 * space counting toward the next line's 75, never inside a UTF-8 sequence.
 * The folded text grows by concatenation, so a long description costs time in
 * proportion to its length, not to its length squared.
 */
export const foldIcsLine = (line: string): string =>
  Array.from(line).reduce<{ readonly text: string; readonly octets: number }>(
    (acc, char) => {
      const size = utf8Length(char)
      return acc.octets + size <= MAX_LINE_OCTETS
        ? { text: acc.text + char, octets: acc.octets + size }
        : { text: `${acc.text}${CRLF} ${char}`, octets: 1 + size }
    },
    { text: '', octets: 0 }
  ).text

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

/** An instant in UTC, `YYYYMMDDTHHMMSSZ`, sub-seconds dropped. */
export const formatIcsUtc = (epochMs: number): string => {
  const at = new Date(epochMs)
  return (
    `${pad(at.getUTCFullYear(), 4)}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}` +
    `T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}Z`
  )
}

/** A time property: `NAME;VALUE=DATE:YYYYMMDD` or `NAME:YYYYMMDDTHHMMSSZ`. */
const timeLine = (name: string, time: IcsTime): string =>
  time.kind === 'date'
    ? `${name};VALUE=DATE:${time.date.replace(/-/g, '')}`
    : `${name}:${formatIcsUtc(time.epochMs)}`

/** A TEXT property, or nothing when the value is empty. */
const textLine = (name: string, value: string | undefined): readonly string[] =>
  value === undefined || value === '' ? [] : [`${name}:${escapeIcsText(value)}`]

const eventLines = (event: IcsWriteEvent): readonly string[] => [
  'BEGIN:VEVENT',
  `UID:${escapeIcsText(event.uid)}`,
  `DTSTAMP:${formatIcsUtc(event.stampMs)}`,
  timeLine('DTSTART', event.start),
  ...(event.end === undefined ? [] : [timeLine('DTEND', event.end)]),
  ...textLine('SUMMARY', event.summary),
  ...textLine('DESCRIPTION', event.description),
  `LAST-MODIFIED:${formatIcsUtc(event.stampMs)}`,
  'END:VEVENT',
]

/** A whole calendar, CRLF-terminated and folded, ready to serve as `text/calendar`. */
export const writeICalendar = (calendar: IcsWriteCalendar): string => {
  const name = escapeIcsText(calendar.name)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sovrium//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `NAME:${name}`,
    `X-WR-CALNAME:${name}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...calendar.events.flatMap(eventLines),
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}
