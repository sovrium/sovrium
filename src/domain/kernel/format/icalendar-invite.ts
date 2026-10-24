/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One event as an iCalendar (RFC 5545) invite — the "add to calendar" file a
 * registration email carries. The calendar feed (`icalendar.ts`) writes every
 * time in UTC; an invite writes a timed event on the wall clock of its zone,
 * as `DTSTART;TZID=<zone>:…`, with the `VTIMEZONE` that defines the zone, so
 * a calendar keeps the hour across a daylight-saving change. An all-day event
 * is written as dates, its end the day after its last day.
 *
 * Every text value is escaped and every line folded with the feed's own
 * helpers, so a value holding a line break cannot add a property or a block.
 * Pure: the zone arithmetic is `Intl`'s, which knows the IANA zones.
 */

import { DateTime, Option } from 'effect'
import { escapeIcsText, foldIcsLine, formatIcsUtc } from './icalendar'

/** A whole day, `YYYY-MM-DD`. */
export interface InviteDay {
  readonly kind: 'date'
  readonly date: string
}

/** An instant, written on the wall clock of `timeZone`. */
export interface InviteTime {
  readonly kind: 'zoned'
  readonly epochMs: number
  readonly timeZone: string
}

/** The event an invite holds. `end` is exclusive, of the same kind as `start`. */
export interface IcsInvite {
  readonly uid: string
  readonly stampMs: number
  readonly summary: string
  readonly start: InviteDay | InviteTime
  readonly end: InviteDay | InviteTime
  readonly location?: string | undefined
  readonly description?: string | undefined
}

const CRLF = '\r\n'
const MINUTE_MS = 60_000

/** Whether the runtime's time-zone database knows `zone`. */
export const isKnownTimeZone = (zone: string): boolean =>
  zone.trim() !== '' && Option.isSome(DateTime.zoneMakeNamed(zone))

/** The wall-clock parts of `epochMs` in `zone`. */
const wallClockParts = (epochMs: number, zone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epochMs))
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0)
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour') % 24,
    minute: part('minute'),
    second: part('second'),
  }
}

/** The offset of `zone` from UTC at `epochMs`, in whole minutes (Paris in winter: 60). */
export const zoneOffsetMinutes = (epochMs: number, zone: string): number => {
  const { year, month, day, hour, minute, second } = wallClockParts(epochMs, zone)
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / MINUTE_MS)
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

/** `epochMs` on the wall clock of `zone`, `YYYYMMDDTHHMMSS`. */
export const formatIcsWallClock = (epochMs: number, zone: string): string => {
  const { year, month, day, hour, minute, second } = wallClockParts(epochMs, zone)
  return `${pad(year, 4)}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}${pad(second)}`
}

/** An offset in minutes as iCalendar writes it, `+0100` / `-0500`. */
const formatOffset = (minutes: number): string => {
  const sign = minutes < 0 ? '-' : '+'
  const absolute = Math.abs(minutes)
  return `${sign}${pad(Math.floor(absolute / 60))}${pad(absolute % 60)}`
}

/** One change of a zone's offset: the instant, and the offsets before and after. */
interface Transition {
  readonly atMs: number
  readonly from: number
  readonly to: number
}

/** The first minute in `(low, high]` at which the offset is no longer `from`. */
const transitionMinute = (zone: string, low: number, high: number, from: number): number => {
  if (high - low <= MINUTE_MS) return high
  const middle = low + Math.floor((high - low) / 2 / MINUTE_MS) * MINUTE_MS
  return zoneOffsetMinutes(middle, zone) === from
    ? transitionMinute(zone, middle, high, from)
    : transitionMinute(zone, low, middle, from)
}

/** Every offset change of `zone` from the start of `fromYear` to the end of `toYear`. */
const transitionsOf = (zone: string, fromYear: number, toYear: number): readonly Transition[] => {
  const months = Array.from({ length: (toYear - fromYear + 1) * 12 + 1 }, (_, index) =>
    Date.UTC(fromYear, index, 1)
  )
  return months.slice(1).flatMap((high, index) => {
    const low = months[index] ?? high
    const from = zoneOffsetMinutes(low, zone)
    const to = zoneOffsetMinutes(high, zone)
    return from === to ? [] : [{ atMs: transitionMinute(zone, low, high, from), from, to }]
  })
}

/** One `STANDARD` or `DAYLIGHT` observance starting at `transition`. */
const observanceLines = (transition: Transition): readonly string[] => {
  const kind = transition.to > transition.from ? 'DAYLIGHT' : 'STANDARD'
  return [
    `BEGIN:${kind}`,
    `DTSTART:${formatIcsUtc(transition.atMs + transition.from * MINUTE_MS).slice(0, -1)}`,
    `TZOFFSETFROM:${formatOffset(transition.from)}`,
    `TZOFFSETTO:${formatOffset(transition.to)}`,
    `END:${kind}`,
  ]
}

/**
 * The `VTIMEZONE` defining `zone` around `epochMs`: its offset changes over the
 * event's year and the year before (so the observance in force at the event is
 * always declared), or one fixed observance for a zone without changes.
 */
const timezoneLines = (zone: string, epochMs: number): readonly string[] => {
  const year = new Date(epochMs).getUTCFullYear()
  const transitions = transitionsOf(zone, year - 1, year)
  const offset = zoneOffsetMinutes(epochMs, zone)
  const observances =
    transitions.length === 0
      ? [
          'BEGIN:STANDARD',
          'DTSTART:19700101T000000',
          `TZOFFSETFROM:${formatOffset(offset)}`,
          `TZOFFSETTO:${formatOffset(offset)}`,
          'END:STANDARD',
        ]
      : transitions.flatMap(observanceLines)
  return ['BEGIN:VTIMEZONE', `TZID:${zone}`, ...observances, 'END:VTIMEZONE']
}

/** A time property: `NAME;VALUE=DATE:YYYYMMDD` or `NAME;TZID=<zone>:YYYYMMDDTHHMMSS`. */
const timeLine = (name: string, time: InviteDay | InviteTime): string =>
  time.kind === 'date'
    ? `${name};VALUE=DATE:${time.date.replace(/-/g, '')}`
    : `${name};TZID=${time.timeZone}:${formatIcsWallClock(time.epochMs, time.timeZone)}`

/** A TEXT property, or nothing when the value is empty. */
const textLine = (name: string, value: string | undefined): readonly string[] =>
  value === undefined || value === '' ? [] : [`${name}:${escapeIcsText(value)}`]

/** The invite as a whole `.ics` file, CRLF-terminated and folded, served as `text/calendar`. */
export const writeICalendarInvite = (invite: IcsInvite): string => {
  const { start, end } = invite
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sovrium//Calendar Invite//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(start.kind === 'zoned' ? timezoneLines(start.timeZone, start.epochMs) : []),
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(invite.uid)}`,
    `DTSTAMP:${formatIcsUtc(invite.stampMs)}`,
    timeLine('DTSTART', start),
    timeLine('DTEND', end),
    ...textLine('SUMMARY', invite.summary),
    ...textLine('LOCATION', invite.location),
    ...textLine('DESCRIPTION', invite.description),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldIcsLine).join(CRLF) + CRLF
}
