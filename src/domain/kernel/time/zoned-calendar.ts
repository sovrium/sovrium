/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DateTime } from 'effect'

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
 * The instant `days` calendar days before `now`, keeping its wall-clock time
 * in `zoneId` (so a day across a DST change is 23 or 25 hours, as on a clock).
 *
 * @param now - the reference instant.
 * @param zoneId - an IANA zone identifier.
 * @param days - how many calendar days to step back.
 */
export const zonedInstantDaysBefore = (now: Readonly<Date>, zoneId: string, days: number) =>
  DateTime.toDateUtc(DateTime.subtract(zonedAt(now, zoneId), { days }))
