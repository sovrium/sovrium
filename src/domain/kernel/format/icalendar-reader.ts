/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reading half of the iCalendar (RFC 5545) subset: the feeds
 * `calendar/importIcs` imports. See `icalendar.ts` for the shapes and the
 * writer.
 */

import { Chunk } from 'effect'
import { shiftDay, type IcsTime } from './icalendar'

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

/** One `VEVENT` as read. Times are the event's own: `end` is exclusive. */
export interface IcsReadEvent {
  readonly uid?: string | undefined
  readonly summary?: string | undefined
  readonly description?: string | undefined
  readonly location?: string | undefined
  readonly url?: string | undefined
  readonly status?: string | undefined
  readonly start: IcsTime
  readonly end?: IcsTime | undefined
  /** The event carries an `RRULE`: it is read once, at its first occurrence. */
  readonly recurring: boolean
  /** The event carries a `RECURRENCE-ID`: a changed occurrence of a series. */
  readonly overridesOccurrence: boolean
}

export type IcsReadResult =
  | {
      readonly ok: true
      readonly events: readonly IcsReadEvent[]
      /** Events left out because a time could not be read. */
      readonly malformed: number
    }
  | { readonly ok: false; readonly reason: 'not-a-calendar' }

/** One parsed content line. */
interface ContentLine {
  readonly name: string
  readonly params: Readonly<Record<string, string>>
  readonly value: string
}

/**
 * Lines unfolded: a line break followed by one space or tab continues the
 * previous line. One pass over the body, whatever its size — a feed is text a
 * stranger wrote, so nothing here may grow faster than its length.
 */
const unfoldLines = (body: string): readonly string[] =>
  body
    .replace(/^\uFEFF/, '')
    .replace(/(?:\r\n|\n|\r)[ \t]/g, '')
    .split(/\r\n|\n|\r/)

/**
 * A content line's `name *(";" param) ":"` head, up to and including the first
 * `:` outside double quotes. The two alternatives start on different
 * characters, so a line is matched in one pass and never backtracked into.
 */
const CONTENT_LINE_HEAD = /^(?:[^":]|"[^"]*")*:/

/** The `;`-separated segments of a head, a quoted `;` kept inside its segment. */
const HEAD_SEGMENT = /(?:[^";]|"[^"]*")+/g

/** Split `name *(";" param) ":" value`, parameter values unquoted, names upper-cased. */
const parseContentLine = (line: string): ContentLine | undefined => {
  const head = CONTENT_LINE_HEAD.exec(line)?.[0]
  if (head === undefined || head.startsWith(';')) return undefined
  const [name, ...rawParams] = head.slice(0, -1).match(HEAD_SEGMENT) ?? []
  if (name === undefined) return undefined
  const params = Object.fromEntries(
    rawParams.flatMap((param) => {
      const eq = param.indexOf('=')
      if (eq <= 0) return []
      const raw = param.slice(eq + 1)
      const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
      return [[param.slice(0, eq).toUpperCase(), unquoted]]
    })
  )
  return { name: name.toUpperCase(), params, value: line.slice(head.length) }
}

/** TEXT unescaping: `\\`, `\;`, `\,`, `\n` and `\N`. */
export const unescapeIcsText = (value: string): string =>
  value.replace(/\\([\\;,nN])/g, (_match, escaped: string) =>
    escaped === 'n' || escaped === 'N' ? '\n' : escaped
  )

/** Whether `Intl` knows `zone` as a time zone. */
const isKnownZone = (zone: string): boolean => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone !== ''
  } catch {
    return false
  }
}

/** The offset of `zone` from UTC at `epochMs`, in milliseconds. */
const zoneOffsetMs = (epochMs: number, zone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(epochMs)
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second')
  )
  return asUtc - Math.floor(epochMs / 1000) * 1000
}

/** The instant a wall-clock time names in `zone`. */
export const wallClockToEpoch = (wallUtcMs: number, zone: string): number => {
  const first = wallUtcMs - zoneOffsetMs(wallUtcMs, zone)
  return wallUtcMs - zoneOffsetMs(first, zone)
}

/** The day (`YYYY-MM-DD`) an instant falls on at the wall clock of `zone`. */
export const dayInZone = (epochMs: number, zone: string): string =>
  new Date(epochMs + zoneOffsetMs(epochMs, isKnownZone(zone) ? zone : 'UTC'))
    .toISOString()
    .slice(0, 10)

const DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/
const DATE_TIME_PATTERN = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/

/** The zone a non-UTC date-time is read in: its known `TZID`, else the default, else UTC. */
const zoneFor = (tzid: string | undefined, defaultTimeZone: string | undefined): string => {
  if (tzid !== undefined && isKnownZone(tzid)) return tzid
  if (defaultTimeZone !== undefined && isKnownZone(defaultTimeZone)) return defaultTimeZone
  return 'UTC'
}

/**
 * Midnight UTC of `year-month-day`, or `undefined` when that is not a calendar
 * day. `Date.UTC` would roll February 30 over to March and read a year below
 * 100 as 19xx, so the day is set on its own and must come back unchanged.
 */
const midnightUtcOf = (year: number, month: number, day: number): number | undefined => {
  const at = new Date(0)
  const ms = at.setUTCFullYear(year, month - 1, day)
  return !Number.isNaN(ms) &&
    at.getUTCFullYear() === year &&
    at.getUTCMonth() === month - 1 &&
    at.getUTCDate() === day
    ? ms
    : undefined
}

/** The wall clock a `YYYYMMDDTHHMMSS` value names, as if it were UTC, or `undefined`. */
const wallClockOf = (match: Readonly<RegExpExecArray>): number | undefined => {
  const [year, month, date, hour, minute, second] = match.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  if (hour > 23 || minute > 59 || second > 60) return undefined
  const midnight = midnightUtcOf(year, month, date)
  return midnight === undefined ? undefined : midnight + ((hour * 60 + minute) * 60 + second) * 1000
}

/** A `DATE` or `DATE-TIME` value, or `undefined` when it is not one. */
const parseTime = (line: ContentLine, defaultTimeZone: string | undefined): IcsTime | undefined => {
  const value = line.value.trim()
  const day = DATE_PATTERN.exec(value)
  if (day !== null) {
    return midnightUtcOf(Number(day[1]), Number(day[2]), Number(day[3])) !== undefined
      ? { kind: 'date', date: `${day[1]}-${day[2]}-${day[3]}` }
      : undefined
  }
  const match = DATE_TIME_PATTERN.exec(value)
  const wall = match === null ? undefined : wallClockOf(match)
  if (match === null || wall === undefined) return undefined
  if (match[7] === 'Z') return { kind: 'date-time', epochMs: wall, timeZone: 'UTC' }
  const zone = zoneFor(line.params['TZID'], defaultTimeZone)
  return { kind: 'date-time', epochMs: wallClockToEpoch(wall, zone), timeZone: zone }
}

const DURATION_PATTERN = /^\+?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/** An RFC 5545 `dur-value` in seconds; a negative or malformed one is `undefined`. */
export const parseIcsDuration = (value: string): number | undefined => {
  const match = DURATION_PATTERN.exec(value.trim())
  if (match === null || value.trim() === 'P' || value.trim().endsWith('T')) return undefined
  const [, weeks, days, hours, minutes, seconds] = match.map((part) => Number(part ?? 0))
  return (
    (weeks ?? 0) * 604_800 +
    (days ?? 0) * 86_400 +
    (hours ?? 0) * 3600 +
    (minutes ?? 0) * 60 +
    (seconds ?? 0)
  )
}

/** The exclusive end of an event: `DTEND`, else `DTSTART` plus `DURATION`, else a day or none. */
const endOf = (
  start: IcsTime,
  end: IcsTime | undefined,
  durationSeconds: number | undefined
): IcsTime | undefined => {
  if (end !== undefined) return end
  if (start.kind === 'date') {
    const days =
      durationSeconds === undefined ? 1 : Math.max(1, Math.floor(durationSeconds / 86_400))
    return { kind: 'date', date: shiftDay(start.date, days) }
  }
  return durationSeconds === undefined
    ? undefined
    : { ...start, epochMs: start.epochMs + durationSeconds * 1000 }
}

/**
 * The properties of one event, by upper-cased name (the first occurrence wins:
 * the lines are read last to first, so an earlier one overwrites a later one).
 */
const byName = (lines: readonly ContentLine[]): ReadonlyMap<string, ContentLine> =>
  new Map(lines.toReversed().map((line) => [line.name, line] as const))

const textOf = (props: ReadonlyMap<string, ContentLine>, name: string): string | undefined => {
  const line = props.get(name)
  return line === undefined ? undefined : unescapeIcsText(line.value)
}

/**
 * An event's start and exclusive end, or `undefined` when its start, its end or
 * its duration is malformed — a malformed `DURATION` beside a good `DTEND` is
 * ignored, since `DTEND` wins.
 */
const timesOf = (
  props: ReadonlyMap<string, ContentLine>,
  defaultTimeZone: string | undefined
): { readonly start: IcsTime; readonly end: IcsTime | undefined } | undefined => {
  const read = (name: string): IcsTime | 'absent' | undefined => {
    const line = props.get(name)
    return line === undefined ? 'absent' : parseTime(line, defaultTimeZone)
  }
  const start = read('DTSTART')
  const end = read('DTEND')
  if (start === undefined || start === 'absent' || end === undefined) return undefined
  if (end !== 'absent') return { start, end }
  const durationLine = props.get('DURATION')
  if (durationLine === undefined) return { start, end: endOf(start, undefined, undefined) }
  const duration = parseIcsDuration(durationLine.value)
  return duration === undefined ? undefined : { start, end: endOf(start, undefined, duration) }
}

/** One event, or `undefined` when its start, end or duration cannot be read. */
const readEvent = (
  lines: readonly ContentLine[],
  defaultTimeZone: string | undefined
): IcsReadEvent | undefined => {
  const props = byName(lines)
  const times = timesOf(props, defaultTimeZone)
  if (times === undefined) return undefined
  return {
    uid: textOf(props, 'UID'),
    summary: textOf(props, 'SUMMARY'),
    description: textOf(props, 'DESCRIPTION'),
    location: textOf(props, 'LOCATION'),
    url: props.get('URL')?.value,
    status: textOf(props, 'STATUS')?.toUpperCase(),
    ...times,
    recurring: props.has('RRULE'),
    overridesOccurrence: props.has('RECURRENCE-ID'),
  }
}

/**
 * Walk state: how deep below the first calendar the walk is, and the open
 * event. The lines gathered are `Chunk`s, whose append does not copy what came
 * before, so reading grows with the feed's length rather than with its square.
 */
interface Walk {
  readonly phase: 'before' | 'inside' | 'after'
  /** How many components are open below the calendar. */
  readonly depth: number
  readonly current: Chunk.Chunk<ContentLine> | undefined
  readonly events: Chunk.Chunk<readonly ContentLine[]>
}

/** A `BEGIN` below the calendar: one component deeper, and an event opened at the top. */
const openComponent = (walk: Walk, component: string): Walk => {
  const depth = walk.depth + 1
  return depth === 1 && component === 'VEVENT'
    ? { ...walk, depth, current: Chunk.empty() }
    : { ...walk, depth }
}

/** An `END` below the calendar: one component up, closing the event at the top. */
const closeComponent = (walk: Walk, component: string): Walk => {
  if (walk.depth === 0) {
    return component === 'VCALENDAR' ? { ...walk, phase: 'after' } : walk
  }
  const closed = walk.depth === 1 ? walk.current : undefined
  return {
    ...walk,
    depth: walk.depth - 1,
    current: closed === undefined ? walk.current : undefined,
    events:
      closed === undefined ? walk.events : Chunk.append(walk.events, Chunk.toReadonlyArray(closed)),
  }
}

const stepWalk = (walk: Walk, line: ContentLine): Walk => {
  if (walk.phase === 'after') return walk
  const component = line.value.trim().toUpperCase()
  if (walk.phase === 'before') {
    return line.name === 'BEGIN' && component === 'VCALENDAR' ? { ...walk, phase: 'inside' } : walk
  }
  if (line.name === 'BEGIN') return openComponent(walk, component)
  if (line.name === 'END') return closeComponent(walk, component)
  // A property belongs to the event only at the event's own level: a VALARM's
  // properties are nested one deeper and never read.
  return walk.depth === 1 && walk.current !== undefined
    ? { ...walk, current: Chunk.append(walk.current, line) }
    : walk
}

/**
 * Read the events of the first `VCALENDAR` of `body`. `defaultTimeZone` is the
 * zone a floating time, or one whose `TZID` `Intl` does not know, is read in.
 */
export const readICalendar = (
  body: string,
  options: { readonly defaultTimeZone?: string | undefined } = {}
): IcsReadResult => {
  const lines = unfoldLines(body).flatMap((raw) => {
    const parsed = raw === '' ? undefined : parseContentLine(raw)
    return parsed === undefined ? [] : [parsed]
  })
  const walk = lines.reduce(stepWalk, {
    phase: 'before',
    depth: 0,
    current: undefined,
    events: Chunk.empty(),
  } satisfies Walk as Walk)
  if (walk.phase === 'before') return { ok: false, reason: 'not-a-calendar' }
  const read = Chunk.toReadonlyArray(walk.events).map((event) =>
    readEvent(event, options.defaultTimeZone)
  )
  const events = read.flatMap((event) => (event === undefined ? [] : [event]))
  return { ok: true, events, malformed: read.length - events.length }
}
