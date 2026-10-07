/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A date-time placed at the wall clock of a named time zone, for FullCalendar.
 *
 * FullCalendar runs in the browser's own zone, so an instant handed to it as an
 * ISO string lands on the reader's clock — a visit at 09:49 UTC read `6:49p`
 * in Tokyo where the grid beside it reads the operator's `5:49 AM`. The grid
 * formats in the field's declared `timeZone`, else the operator zone the server
 * stamps on the page; the calendar follows the same rule by handing FullCalendar
 * a FLOATING wall-clock string (`2026-09-23T05:49:00`, no offset), which it
 * places as written, and by turning a dropped wall clock back into the instant
 * it names before writing it.
 *
 * `Intl` does the zone arithmetic: no time-zone library reaches the calendar's
 * bundle. A zone `Intl` does not know leaves the value as it was.
 *
 * One limit is FullCalendar's: it hands a drop or a click back as a `Date` in
 * the BROWSER's zone, so a wall clock that zone skips at spring-forward reads an
 * hour later. It bites only a reader whose own zone differs from the operator's,
 * dropping into that one hour of the year.
 */

const formatters = new Map<string, Intl.DateTimeFormat>()

/** A formatter writing every wall-clock part in `zone`, two digits each, hours 00–23. */
const formatterFor = (zone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(zone)
  if (cached !== undefined) return cached
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  formatters.set(zone, formatter)
  return formatter
}

/** `instant` as the `YYYY-MM-DDTHH:mm:ss` wall clock of `zone`, or `undefined` when either is unusable. */
export function toZonedWallClock(instant: Date, zone: string): string | undefined {
  if (Number.isNaN(instant.getTime())) return undefined
  try {
    const parts = formatterFor(zone).formatToParts(instant)
    const part = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((entry) => entry.type === type)?.value ?? '00'
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`
  } catch {
    // A zone `Intl` does not know: the value stays where FullCalendar puts it.
    return undefined
  }
}

/** A bare `YYYY-MM-DD`: a calendar day, which no zone moves. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A stored instant as the wall clock of `zone`; the stored text when it cannot
 * be placed. A bare calendar day stays as written — FullCalendar draws it all
 * day — even where the caller could not say the field holds days (the view
 * switcher's calendar has no field schema), so it never turns into midnight UTC
 * read in the zone, the evening before west of Greenwich.
 */
export function placeInZone(stored: string, zone: string | undefined): string {
  if (zone === undefined || CALENDAR_DAY.test(stored)) return stored
  return toZonedWallClock(new Date(stored), zone) ?? stored
}

/** How far `zone`'s wall clock runs ahead of UTC at `utcMs`, in milliseconds. */
const offsetAt = (utcMs: number, zone: string): number => {
  const wall = toZonedWallClock(new Date(utcMs), zone)
  return wall === undefined ? 0 : Date.parse(`${wall}Z`) - utcMs
}

const DAY_MS = 86_400_000

/**
 * The instant a FullCalendar date names when it reads as the wall clock of
 * `zone` — the inverse of {@link placeInZone}, for a drop or a click written
 * back to the record. FullCalendar's `Date` carries the wall clock in the
 * browser's local parts.
 *
 * A zone `Intl` does not know — `local` among them, the field option meaning
 * "the reader's browser" — left the event on the browser's clock, so the local
 * reading is the instant.
 *
 * Around a daylight-saving change the offsets a day either side bracket the
 * answer, resolved as `Temporal`'s `compatible` does: a wall clock that occurs
 * twice (clocks went back) takes its EARLIER instant, and one that never occurs
 * (clocks went forward) moves forward by the gap — the same whichever side of
 * UTC the zone sits.
 */
export function instantFromZonedWallClock(local: Date, zone: string | undefined): string {
  if (zone === undefined || toZonedWallClock(new Date(0), zone) === undefined) {
    return local.toISOString()
  }
  const asUtc = Date.UTC(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    local.getSeconds()
  )
  const earlierOffset = asUtc - offsetAt(asUtc - DAY_MS, zone)
  const laterOffset = asUtc - offsetAt(asUtc + DAY_MS, zone)
  const names = (instant: number): boolean => instant + offsetAt(instant, zone) === asUtc
  const candidates = [Math.min(earlierOffset, laterOffset), Math.max(earlierOffset, laterOffset)]
  // Neither names it: a skipped wall clock, read at the offset in force before the change.
  return new Date(candidates.find(names) ?? earlierOffset).toISOString()
}
