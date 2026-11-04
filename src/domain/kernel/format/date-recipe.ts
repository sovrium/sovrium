/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dateFormatterOf, formatZonedDate, toDate } from './day-relative-time'

/**
 * A date reading written as DATA: the pieces a moment is spelled with, in order.
 *
 * The server decides how a `datetime` reads (a field's `dateFormat`, its
 * `timeFormat`, a `format` pattern); a browser has to write the same text — a
 * grid cell drawn after the page loaded, a value whose field asks for each
 * reader's own zone. A recipe is how the decision crosses that boundary: plain
 * JSON a grid prop or a `data-` attribute can carry, followed with nothing but
 * `Intl`, so a browser and the server can never spell one moment two ways and
 * no browser ever needs the pattern tokenizer.
 *
 * - a string is written as it is (`/`, `:`, `, `, quoted text);
 * - `{ f }` is the moment through `Intl` in the page language (a month name);
 * - `{ p, t }` is ONE part of it, the `t` part of `Intl`'s reading under `p`,
 *   written with Latin digits (`en-US`) so `20/11/2026` reads the same on any page;
 * - `{ ap }` is `AM` or `PM`, by the hour of the 24-hour clock.
 */
export type DateRecipePart =
  | string
  | { readonly f: Readonly<Intl.DateTimeFormatOptions> }
  | {
      readonly p: Readonly<Intl.DateTimeFormatOptions>
      readonly t: Intl.DateTimeFormatPartTypes
    }
  | { readonly ap: 1 }

export type DateRecipe = readonly DateRecipePart[]

const HOUR_24 = { hour: '2-digit', hourCycle: 'h23' } as const

/**
 * The `type` part of `date` under `options`, in Latin digits, at `timeZone`; a
 * zone `Intl` does not know degrades to the runtime's, as `formatZonedDate` does.
 */
const partOf = (
  date: Readonly<Date>,
  options: Readonly<Intl.DateTimeFormatOptions>,
  type: Intl.DateTimeFormatPartTypes,
  timeZone: string | undefined
): string => {
  const zoned = timeZone === undefined ? options : { ...options, timeZone }
  try {
    return (
      dateFormatterOf('en-US', zoned)
        .formatToParts(date as Date)
        .find((part) => part.type === type)?.value ?? ''
    )
  } catch {
    return partOf(date, options, type, undefined)
  }
}

const writePart = (
  date: Readonly<Date>,
  part: DateRecipePart,
  locale: string,
  timeZone: string | undefined
): string => {
  if (typeof part === 'string') return part
  if ('f' in part) return formatZonedDate(date, locale, part.f, timeZone)
  if ('p' in part) return partOf(date, part.p, part.t, timeZone)
  return Number(partOf(date, HOUR_24, 'hour', timeZone)) >= 12 ? 'PM' : 'AM'
}

/**
 * `value` written through `recipe`, in `locale`, at the wall clock of
 * `timeZone` (`local` or none: the runtime's own, which in a browser is the
 * reader's). A value that names no moment is returned as it came.
 */
export function formatDateRecipe(
  value: unknown,
  recipe: DateRecipe,
  locale: string,
  timeZone: string | undefined
): string {
  const date = toDate(value)
  if (date === undefined) return String(value)
  const zone = timeZone === '' || timeZone === 'local' ? undefined : timeZone
  return recipe.map((part) => writePart(date, part, locale, zone)).join('')
}
