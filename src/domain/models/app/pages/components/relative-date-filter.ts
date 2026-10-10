/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Relative date tokens in a filter value.
 *
 * A filter can name a day relative to the day it is read: `$today`,
 * `$today+Nd` / `$today-Nd`, `$today+Nw` / `$today-Nw`, `$startOfMonth` and
 * `$startOfNextMonth`. Each is resolved once per request to a `YYYY-MM-DD`
 * calendar day — the server's UTC day — by the engine, on both dialects, and
 * never left to a database's date parser (PostgreSQL reads a literal
 * `'$today'` as its own `today` keyword, which would hide a missing resolution
 * for that one token and fail for every other).
 *
 * A filter can also name an INSTANT: `$now` and `$now±N` in minutes (`m`),
 * hours (`h`), days (`d`) or weeks (`w`) — `$now-1h` is the last hour by
 * elapsed time, where `$today-1d` is yesterday's whole calendar day. Each is
 * resolved once per request to a UTC ISO 8601 instant rounded down to the
 * minute, so a page reading one stays the same for that minute.
 *
 * The grammar is CLOSED: months and years are anchors, never offsets, because
 * they have no fixed length, and an instant has no second. Anything else
 * beginning with `$today`, `$now` or `$startOf` is refused at boot, naming the
 * grammar ({@link validateRelativeDateFilters}).
 *
 * Pure: the day and the instant are arguments.
 */

/** The tokens a filter value may use, as the refusal lists them. */
export const RELATIVE_DATE_GRAMMAR =
  '$today, $today+Nd, $today-Nd, $today+Nw, $today-Nw, $startOfMonth, $startOfNextMonth, $now, $now+Nm, $now-Nm (and h, d, w)'

const OFFSET_TOKEN = /^\$today(?:([+-])(\d{1,4})([dw]))?$/

const INSTANT_TOKEN = /^\$now(?:([+-])(\d{1,4})([mhdw]))?$/

/** Milliseconds per instant offset unit. */
const UNIT_MS: Readonly<Record<string, number>> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

/** True for a value that claims to be a relative date — valid or not. */
const claimsRelativeDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  (value.startsWith('$today') || value.startsWith('$startOf') || value.startsWith('$now'))

/** The instant a `$now` token names, relative to `now` (an ISO instant), or `undefined`. */
const resolveInstant = (value: string, now: string): string | undefined => {
  const match = INSTANT_TOKEN.exec(value)
  if (match === null) return undefined
  const [, sign, amount, unit] = match
  if (sign === undefined) return now
  const offset = Number(amount) * (UNIT_MS[unit ?? 'm'] ?? 0)
  return new Date(Date.parse(now) + (sign === '-' ? -offset : offset)).toISOString()
}

/** The year, month (1-12) and day of a `YYYY-MM-DD` day. */
const partsOf = (day: string): readonly [number, number, number] => [
  Number(day.slice(0, 4)),
  Number(day.slice(5, 7)),
  Number(day.slice(8, 10)),
]

/** `YYYY-MM-DD` of a UTC day `days` after `day`. */
const shiftDay = (day: string, days: number): string => {
  const [year, month, date] = partsOf(day)
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10)
}

/** The first day of the month `months` after the month of `day`. */
const monthStart = (day: string, months: number): string => {
  const [year, month] = partsOf(day)
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10)
}

/**
 * The calendar day a token names, relative to `today` (`YYYY-MM-DD`) — or for
 * a `$now` token the instant, relative to `now` (an ISO instant on a whole
 * minute, {@link utcMinuteInstant}) — or `undefined` when the value is not a
 * token of the grammar. Without `now`, a `$now` token is left unresolved.
 */
export function resolveRelativeDate(
  value: string,
  today: string,
  now?: string
): string | undefined {
  if (value.startsWith('$now')) return now === undefined ? undefined : resolveInstant(value, now)
  if (value === '$startOfMonth') return monthStart(today, 0)
  if (value === '$startOfNextMonth') return monthStart(today, 1)
  const match = OFFSET_TOKEN.exec(value)
  if (match === null) return undefined
  const [, sign, amount, unit] = match
  if (sign === undefined) return today
  const days = Number(amount) * (unit === 'w' ? 7 : 1)
  return shiftDay(today, sign === '-' ? -days : days)
}

/**
 * Every relative token under `value` — a filter array, a condition, a nested
 * group — replaced by the day it names. A structure holding none comes back by
 * reference.
 */
export function resolveRelativeDatesIn<T>(value: T, today: string, now?: string): T {
  if (claimsRelativeDate(value)) return (resolveRelativeDate(value, today, now) ?? value) as T
  if (Array.isArray(value)) {
    const mapped = value.map((entry: unknown) => resolveRelativeDatesIn(entry, today, now))
    return (mapped.every((entry, index) => entry === value[index]) ? value : mapped) as T
  }
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value)
  const mapped = entries.map(
    ([key, entry]) => [key, resolveRelativeDatesIn(entry, today, now)] as const
  )
  return (
    mapped.every(([, entry], index) => entry === entries[index]?.[1])
      ? value
      : Object.fromEntries(mapped)
  ) as T
}

/** Today's UTC calendar day, `YYYY-MM-DD`, from an instant. */
export const utcCalendarDay = (instant: Readonly<Date>): string =>
  instant.toISOString().slice(0, 10)

/** An instant rounded down to its UTC minute, as ISO 8601: what `$now` names. */
export const utcMinuteInstant = (instant: Readonly<Date>): string =>
  new Date(Math.floor(instant.getTime() / 60_000) * 60_000).toISOString()

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every string under a filter that claims to be a relative date. */
function claimedTokens(filter: unknown): readonly string[] {
  if (claimsRelativeDate(filter)) return [filter]
  if (Array.isArray(filter)) return filter.flatMap(claimedTokens)
  if (isRecord(filter)) return Object.values(filter).flatMap(claimedTokens)
  return []
}

/** Every object at any depth. */
function collectNodes(node: unknown): readonly RawRecord[] {
  if (Array.isArray(node)) return node.flatMap(collectNodes)
  if (!isRecord(node)) return []
  return [node, ...Object.values(node).flatMap(collectNodes)]
}

/**
 * Every value under a filter that claims to be a relative date and is not a
 * token of the grammar — `$today+1m`, `$startOfYear`.
 */
export const unknownRelativeDateTokens = (filter: unknown): readonly string[] =>
  claimedTokens(filter).filter(
    (token) => resolveRelativeDate(token, '2000-01-01', '2000-01-01T00:00:00.000Z') === undefined
  )

/** The refusal of one value outside the grammar, naming the tokens that exist. */
export const describeUnknownRelativeDate = (token: string): string =>
  `Filter value '${token}' is not a relative date. A filter may name ${RELATIVE_DATE_GRAMMAR} — N a whole number of days (d) or weeks (w), or after $now also of minutes (m) or hours (h); months and years are anchors only.`

/**
 * Refuse a filter value that claims to be a relative date and is not one of
 * the grammar's tokens.
 *
 * @returns one message per offending value, empty otherwise
 */
export function validateRelativeDateFilters(config: unknown): readonly string[] {
  const pages = isRecord(config) ? config['pages'] : undefined
  if (!Array.isArray(pages)) return []
  return collectNodes(pages)
    .flatMap((node) =>
      isRecord(node['dataSource']) ? unknownRelativeDateTokens(node['dataSource']['filter']) : []
    )
    .map(describeUnknownRelativeDate)
}
