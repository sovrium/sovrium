/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatDateRecipe } from '../../../kernel/format/date-recipe'
import { tokenizePattern } from '../../../kernel/format/date-tokens'
import { MONTH_DAY, YEAR } from '../../../kernel/format/day-relative-time'
import { usableLocale } from '../../../kernel/format/usable-locale'
import { DATE_TIME, formatCellValue, TIME, type CellFormatOptions } from './cell-value-format'
import type { DateRecipe, DateRecipePart } from '../../../kernel/format/date-recipe'
import type { ColumnFormat } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * How a `datetime` field's own display options read, as a recipe
 * (`kernel/format/date-recipe.ts`) every surface follows: a list item, a text
 * writing `$record.<field>`, a `record-field`, a grid cell. Decided once, on the
 * server, from the field; the grid and a reader-zone value follow the recipe in
 * the browser with nothing but `Intl`.
 *
 * - `format` — a pattern in the closed date tokens (`kernel/format/date-tokens.ts`),
 *   which wins over the two presets;
 * - `dateFormat` — the day as numbers, exactly as the records API's
 *   `?format=display` writes it (`US` 11/20/2026, `European` 20/11/2026,
 *   `ISO` year, month and day with zeros, dashed);
 * - `timeFormat` — the clock: `24-hour` 13:00, `12-hour` 1:00 PM.
 *
 * With either preset set, the date and the time are joined by one space.
 */

const YEAR_PART: DateRecipePart = { p: { year: 'numeric' }, t: 'year' }
const MONTH_PART: DateRecipePart = { p: { month: 'numeric' }, t: 'month' }
const MONTH_2_PART: DateRecipePart = { p: { month: '2-digit' }, t: 'month' }
const DAY_PART: DateRecipePart = { p: { day: 'numeric' }, t: 'day' }
const DAY_2_PART: DateRecipePart = { p: { day: '2-digit' }, t: 'day' }
const HOUR_24_PART: DateRecipePart = { p: { hour: '2-digit', hourCycle: 'h23' }, t: 'hour' }
const HOUR_12_PART: DateRecipePart = { p: { hour: 'numeric', hourCycle: 'h12' }, t: 'hour' }
const MINUTE_PART: DateRecipePart = {
  p: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  t: 'minute',
}
const SECOND_PART: DateRecipePart = { p: { minute: '2-digit', second: '2-digit' }, t: 'second' }

/** Each canonical date token as the recipe part that writes it. */
const TOKEN_PARTS: Readonly<Record<string, DateRecipePart>> = {
  yyyy: YEAR_PART,
  YYYY: YEAR_PART,
  MM: MONTH_2_PART,
  dd: DAY_2_PART,
  DD: DAY_2_PART,
  d: DAY_PART,
  D: DAY_PART,
  HH: HOUR_24_PART,
  mm: MINUTE_PART,
  ss: SECOND_PART,
  MMMM: { f: { month: 'long' } },
  MMM: { f: { month: 'short' } },
  EEEE: { f: { weekday: 'long' } },
  EEE: { f: { weekday: 'short' } },
}

/** A `format` pattern as a recipe, or `undefined` when it does not compile. */
export const patternRecipeOf = (pattern: string): DateRecipe | undefined => {
  const segments = tokenizePattern(pattern)
  if (!segments.ok) return undefined
  return segments.value.map((segment) =>
    segment.kind === 'literal' ? segment.text : (TOKEN_PARTS[segment.token] ?? segment.token)
  )
}

/** The day as numbers under a `dateFormat` preset. */
const DATE_RECIPES: Readonly<Record<string, DateRecipe>> = {
  US: [MONTH_PART, '/', DAY_PART, '/', YEAR_PART],
  European: [DAY_PART, '/', MONTH_PART, '/', YEAR_PART],
  ISO: [YEAR_PART, '-', MONTH_2_PART, '-', DAY_2_PART],
}

/** The time of day under a `timeFormat` preset. */
const CLOCK_RECIPES: Readonly<Record<string, DateRecipe>> = {
  '24-hour': [HOUR_24_PART, ':', MINUTE_PART],
  '12-hour': [HOUR_12_PART, ':', MINUTE_PART, ' ', { ap: 1 }],
}

/** The day and the time a reading falls back to when a field names only one preset. */
const DEFAULT_DATE: DateRecipe = [{ f: { month: 'short', day: 'numeric', year: 'numeric' } }]
const DEFAULT_TIME: DateRecipe = [{ f: { hour: '2-digit', minute: '2-digit' } }]

/** A field as this service reads it: whatever it declares. */
type DisplayField = Readonly<Record<string, unknown>> | undefined

const stringKey = (field: DisplayField, key: string): string | undefined => {
  const value = field?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * The clock a field's `timeFormat` names, for a time-only reading (the `time`
 * column format), or `undefined` when it names none.
 */
export const clockRecipeOf = (field: DisplayField): DateRecipe | undefined => {
  const timeFormat = stringKey(field, 'timeFormat')
  return timeFormat === undefined ? undefined : CLOCK_RECIPES[timeFormat]
}

/**
 * How a `datetime` field reads wherever a surface names no format of its own,
 * or `undefined` when it declares none of `format`, `dateFormat`, `timeFormat`
 * (and reads as it always did). A pattern that does not compile is refused when
 * the app starts, so here it simply falls back to the presets.
 */
export const fieldDateTimeRecipeOf = (field: DisplayField): DateRecipe | undefined => {
  if (field?.['type'] !== 'datetime') return undefined
  const pattern = stringKey(field, 'format')
  const fromPattern = pattern === undefined ? undefined : patternRecipeOf(pattern)
  if (fromPattern !== undefined) return fromPattern
  const dateFormat = stringKey(field, 'dateFormat')
  const date = dateFormat === undefined ? undefined : DATE_RECIPES[dateFormat]
  const clock = clockRecipeOf(field)
  if (date === undefined && clock === undefined) return undefined
  return [...(date ?? DEFAULT_DATE), ' ', ...(clock ?? DEFAULT_TIME)]
}

/**
 * The `datetime` column format as a recipe: its date, `glue` and time when the
 * glue is known, else the one `Intl` reading — the text `formatDateTimeJoined`
 * and `formatDateTimeColumn` write, for a browser to write again in its reader's zone.
 */
export const dateTimeColumnRecipe = (glue: string | undefined): DateRecipe =>
  glue === undefined ? [{ f: DATE_TIME }] : [{ f: { ...MONTH_DAY, ...YEAR } }, glue, { f: TIME }]

/** The `time` column format as a recipe: the field's clock when it names one. */
export const timeColumnRecipe = (clock: DateRecipe | undefined): DateRecipe =>
  clock ?? [{ f: TIME }]

/**
 * A value through a component's own `format`, as `formatCellValue` writes it,
 * except a `time` reading, which takes the clock its field's `timeFormat` names.
 */
export const formatFieldColumnValue = (
  value: unknown,
  format: ColumnFormat,
  locale: string,
  options: CellFormatOptions & { readonly clock?: DateRecipe | undefined }
): string =>
  format === 'time' && options.clock !== undefined && value !== null && value !== undefined
    ? formatDateRecipe(value, options.clock, usableLocale(locale), options.timeZone)
    : formatCellValue(value, format, locale, options)
