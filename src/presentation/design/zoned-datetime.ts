/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". */

/**
 * A `datetime` column read as a wall-clock reading in its declared `timeZone`,
 * and written back as an ISO instant.
 *
 * Shared by the data table's cell editor and the form's control, so the two
 * surfaces that edit the same column cannot disagree about which instant a
 * reading means. The zone is the column's `timeZone` (capital Z) — the same
 * spelling the read-only formatter reads.
 */

/** The zone used when the field declares none: the reader's own. */
export const LOCAL_ZONE = 'local'

/**
 * Format an instant as the `YYYY-MM-DDTHH:mm` a `datetime-local` input holds,
 * with the wall-clock reading taken in `zone`.
 *
 * `Intl` is what does the zone arithmetic. Hand-rolling an offset would be
 * wrong twice a year for every zone that observes DST.
 */
export function toLocalInputValue(value: unknown, zone: string): string {
  if (value === null || value === undefined || value === '') return ''
  const instant = new Date(String(value))
  if (Number.isNaN(instant.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    ...(zone !== LOCAL_ZONE && { timeZone: zone }),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant)

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? ''
  // `hour12: false` can render midnight as `24` in some ICU builds.
  const hour = part('hour') === '24' ? '00' : part('hour')
  return `${part('year')}-${part('month')}-${part('day')}T${hour}:${part('minute')}`
}

/**
 * Read a `datetime-local` wall-clock reading back as an instant in `zone`.
 *
 * The offset is measured by asking what wall-clock time the naive-UTC reading
 * lands on in the target zone, and correcting by the difference. That is the
 * inverse of {@link toLocalInputValue} and, unlike a fixed offset table, it is
 * right on both sides of a DST boundary.
 */
export function fromLocalInputValue(local: string, zone: string): string | null {
  if (local.trim() === '') return null
  const naive = new Date(`${local}Z`)
  if (Number.isNaN(naive.getTime())) return null
  if (zone === LOCAL_ZONE) {
    const asLocal = new Date(local)
    return Number.isNaN(asLocal.getTime()) ? null : asLocal.toISOString()
  }

  const asZoned = new Date(toLocalInputValue(naive.toISOString(), zone) + 'Z')
  const offsetMs = asZoned.getTime() - naive.getTime()
  return new Date(naive.getTime() - offsetMs).toISOString()
}
