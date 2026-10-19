/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a moment reads in a feed — the `day-relative-time` column format — and
 * the zoned, memoised date formatting it rests on.
 *
 * Its own module, rather than a member of the grid's value formatter, for the
 * reason `usable-locale.ts` gives: the conversations viewer, the command
 * palette and the API keys page print a moment and nothing else, and importing
 * the grid's formatter carried its currency, byte and duration arithmetic into
 * islands that format none of them. The server reaches the same reading here
 * when it composes a moment into a sentence (a pause's `<actor> · <moment>`),
 * so a moment reads alike wherever the console prints it.
 */

/** A value read as a date; `undefined` when it names none. */
export function toDate(value: unknown): Readonly<Date> | undefined {
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * One `Intl.DateTimeFormat` per locale and options, built once. Building one is
 * what `toLocaleDateString` does on every call, and it costs far more than the
 * formatting itself: a page printing a date on every row of a list paid it per
 * cell. The keys are bounded by the app's languages, its zones and the few
 * option sets the formats use; past the cap a formatter is simply not kept.
 */
const DATE_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

export const dateFormatterOf = (
  locale: string,
  options: Readonly<Intl.DateTimeFormatOptions>
): Intl.DateTimeFormat => {
  const key = locale + JSON.stringify(options)
  const formatter = DATE_FORMATTERS.get(key) ?? new Intl.DateTimeFormat(locale, options)
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- the memo write IS the state this cache holds; a formatter is a pure function of its key
  if (DATE_FORMATTERS.size < 256) DATE_FORMATTERS.set(key, formatter)
  return formatter
}

/**
 * `value` through `options` in `locale`, at the wall clock of `timeZone` (the
 * runtime's own zone when `undefined`); the value as text when it names no date.
 */
export function formatZonedDate(
  value: unknown,
  locale: string,
  options: Readonly<Intl.DateTimeFormatOptions>,
  timeZone: string | undefined
): string {
  const date = toDate(value)
  if (date === undefined) return String(value)
  const zoned = timeZone === undefined ? options : { ...options, timeZone }
  try {
    return dateFormatterOf(locale, zoned).format(date as Date)
  } catch {
    // An unknown zone (a `RangeError`) degrades to the runtime's own zone
    // rather than taking the whole grid down with it.
    return dateFormatterOf(locale, options).format(date as Date)
  }
}

/** The month and the day; with {@link YEAR}, the date formats' common ground. */
export const MONTH_DAY = { month: 'short', day: 'numeric' } as const
export const YEAR = { year: 'numeric' } as const

/** A 24-hour time of day, `06:00`, and the `YYYY-MM-DD` key a calendar day compares by. */
const CLOCK = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const
const DAY_KEY = { year: 'numeric', month: '2-digit', day: '2-digit' } as const

/** A moment's reading, and whether it names a relative day (today, yesterday). */
export interface DayRelativeReading {
  readonly relative: boolean
  readonly text: string
}

/**
 * A `day-relative-time` as it reads INSIDE a sentence: a relative day keeps
 * `Intl`'s own case — `today 06:00`, `aujourd’hui 06:00` — and `relative` says
 * so, because a sentence words the two kinds apart (« commencée aujourd’hui »,
 * « commencée le 13 oct. »). See {@link formatDayRelativeTime} for the reading.
 */
export function readDayRelativeTime(
  value: unknown,
  locale: string,
  timeZone: string | undefined,
  now: Readonly<Date> = new Date()
): DayRelativeReading {
  const date = toDate(value)
  if (date === undefined) return { relative: false, text: String(value) }
  const day = formatZonedDate(date, 'en-CA', DAY_KEY, timeZone)
  const today = formatZonedDate(now, 'en-CA', DAY_KEY, timeZone)
  const offset = Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000)
  const clock = formatZonedDate(date, locale, CLOCK, timeZone)
  if (offset === 0 || offset === -1) {
    const word = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(offset, 'day')
    return { relative: true, text: `${word} ${clock}` }
  }
  const year = day.slice(0, 4) === today.slice(0, 4) ? {} : YEAR
  return {
    relative: false,
    text: `${formatZonedDate(date, locale, { ...MONTH_DAY, ...year }, timeZone)}, ${clock}`,
  }
}

/**
 * A `day-relative-time`: an instant as a feed reads it, relative to the
 * reader's day — `Today 06:00`, `Yesterday 18:00` (the two words `Intl`'s own,
 * in `locale`, capitalised to start the line) — then the day and short month,
 * a comma and the time (`Oct 13, 07:30`, `13 oct., 07:30`), the year only for
 * another year. Always a 24-hour clock; the day and the year are read in
 * `timeZone` (the operator zone). The comma is joined here rather than by
 * `Intl`, whose words between a date and a time differ between runtimes
 * (`Oct 13 at 07:30`).
 *
 * `now` is the instant "today" is read at: the runtime's clock when unset. The
 * server passes its own, so a development clock decides the day there too; a
 * browser's clock is the reader's.
 */
export function formatDayRelativeTime(
  value: unknown,
  locale: string,
  timeZone: string | undefined,
  now: Readonly<Date> = new Date()
): string {
  const { relative, text } = readDayRelativeTime(value, locale, timeZone, now)
  return relative ? `${text.charAt(0).toLocaleUpperCase(locale)}${text.slice(1)}` : text
}
