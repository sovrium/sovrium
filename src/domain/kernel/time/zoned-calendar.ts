/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DateTime, Option } from 'effect'

/**
 * Calendar arithmetic in an explicit IANA zone.
 *
 * Every function takes the zone as a parameter and never reads the process
 * zone: a `Date`'s local getters (`getDate`, `getHours`, `setDate`) follow
 * POSIX `TZ`, which belongs to the host, so a calendar day computed with them
 * moves whenever the host's image does. These helpers answer "which day is it,
 * and when did it start" on the wall clock of the zone they are handed.
 *
 * Results are returned with `DateTime.toDateUtc`, the real instant: `toDate` on
 * a zoned value returns a Date whose UTC fields spell the WALL clock, which is
 * a different instant everywhere but UTC.
 *
 * Pure: `now` is injected, the zone is a string, and nothing global is read.
 * An unknown zone throws, which callers never see in practice because the
 * operator zone is validated at boot.
 */

/** `now` placed on the wall clock of `zoneId`. */
const zonedAt = (now: Readonly<Date>, zoneId: string) =>
  DateTime.makeZonedUnsafe(now.getTime(), { timeZone: zoneId })

/**
 * The calendar date of `now` in `zoneId`, as `YYYY-MM-DD`.
 *
 * @param now - the reference instant.
 * @param zoneId - an IANA zone identifier.
 */
export const zonedIsoDate = (now: Readonly<Date>, zoneId: string): string =>
  DateTime.formatIsoDate(zonedAt(now, zoneId))

/**
 * Minutes elapsed since midnight of `now`'s calendar day in `zoneId`.
 *
 * @param now - the reference instant.
 * @param zoneId - an IANA zone identifier.
 */
export const zonedMinutesSinceMidnight = (now: Readonly<Date>, zoneId: string): number => {
  const parts = DateTime.toParts(zonedAt(now, zoneId))
  return parts.hour * 60 + parts.minute
}

/**
 * Midnight, in `zoneId`, of the calendar day `years` years before `now`'s.
 *
 * @param now - the reference instant.
 * @param zoneId - an IANA zone identifier.
 * @param years - how many calendar years to step back.
 */
export const zonedStartOfDayYearsBefore = (now: Readonly<Date>, zoneId: string, years: number) =>
  DateTime.toDateUtc(DateTime.subtract(DateTime.startOf(zonedAt(now, zoneId), 'day'), { years }))

/**
 * Midnight, in `zoneId`, of the calendar day `days` days before `now`'s.
 *
 * @param now - the reference instant.
 * @param zoneId - an IANA zone identifier.
 * @param days - how many calendar days to step back.
 */
export const zonedStartOfDayDaysBefore = (now: Readonly<Date>, zoneId: string, days: number) =>
  DateTime.toDateUtc(DateTime.subtract(DateTime.startOf(zonedAt(now, zoneId), 'day'), { days }))

/**
 * The instant `days` calendar days before `now`, keeping its wall-clock time
 * in `zoneId` (so a day across a DST change is 23 or 25 hours, as on a clock).
 *
 * @param now - the reference instant.
 * @param zoneId - an IANA zone identifier.
 * @param days - how many calendar days to step back.
 */
export const zonedInstantDaysBefore = (now: Readonly<Date>, zoneId: string, days: number) =>
  DateTime.toDateUtc(DateTime.subtract(zonedAt(now, zoneId), { days }))

/** The calendar day `isoDate` (`YYYY-MM-DD`) at its midnight on the wall clock of `zoneId`. */
const zonedMidnightOf = (isoDate: string, zoneId: string) => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number)
  return DateTime.startOf(
    DateTime.makeZonedUnsafe({ year, month, day }, { timeZone: zoneId, adjustForTimeZone: true }),
    'day'
  )
}

/**
 * The instant the calendar day `isoDate` (`YYYY-MM-DD`) starts in `zoneId`: its
 * midnight on that zone's clock, so a summer day in `Europe/Paris` starts at
 * 22:00 UTC on the day before.
 *
 * @param isoDate - a calendar day, `YYYY-MM-DD`.
 * @param zoneId - an IANA zone identifier.
 */
export const zonedStartOfIsoDate = (isoDate: string, zoneId: string) =>
  DateTime.toDateUtc(zonedMidnightOf(isoDate, zoneId))

/**
 * The instant the calendar day AFTER `isoDate` starts in `zoneId` — the
 * exclusive end of `isoDate`, 23 or 25 hours after its start across a DST
 * change, as on a clock.
 *
 * @param isoDate - a calendar day, `YYYY-MM-DD`.
 * @param zoneId - an IANA zone identifier.
 */
export const zonedEndOfIsoDate = (isoDate: string, zoneId: string) =>
  DateTime.toDateUtc(DateTime.add(zonedMidnightOf(isoDate, zoneId), { days: 1 }))

/** A wall-clock reading with no zone or offset: `YYYY-MM-DDTHH:mm`, seconds optional. */
const WALL_CLOCK_READING = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** Whether `[year, month, day, hour, minute, second]` names a minute that exists, unrolled. */
const isRealMinute = (parts: readonly number[]): boolean => {
  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0] = parts
  const at = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const read = [
    at.getUTCFullYear(),
    at.getUTCMonth() + 1,
    at.getUTCDate(),
    at.getUTCHours(),
    at.getUTCMinutes(),
    at.getUTCSeconds(),
  ]
  return read.every((value, index) => value === parts[index])
}

/**
 * The instant a wall-clock reading such as `2026-11-04T10:00` (what a
 * `datetime-local` control posts) names on the clock of `zoneId`, at the
 * offset in force on that day; `undefined` when `reading` is not one — an
 * instant with its own offset or `Z` included, which needs no zone — when it
 * names no real minute (`2026-02-30T09:00`, `25:00`), which is never rolled
 * over into another day, or when `zoneId` is no zone the runtime knows (a
 * column's `local`, which only the visitor's browser can resolve).
 *
 * @param reading - a `YYYY-MM-DDTHH:mm[:ss]` wall-clock reading.
 * @param zoneId - an IANA zone identifier.
 */
export const zonedWallClockInstant = (
  reading: string,
  zoneId: string
): Readonly<Date> | undefined => {
  const match = WALL_CLOCK_READING.exec(reading)
  const zone = DateTime.zoneMakeNamed(zoneId)
  if (match === null || Option.isNone(zone)) return undefined
  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map((part) => Number(part ?? 0))
  if (!isRealMinute([year, month, day, hour, minute, second])) return undefined
  return DateTime.toDateUtc(
    DateTime.makeZonedUnsafe(
      { year, month, day, hour, minute, second },
      { timeZone: zone.value, adjustForTimeZone: true }
    )
  )
}
