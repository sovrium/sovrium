/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Date helper implementations, built on `@/domain/services/date-tokens`.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The six original date helpers formatted through six sequential global string
 * replaces (`/YYYY/g`, `/MM/g`, …) against UTC-only parts. That has two defects
 * a replace-chain cannot fix, both now covered by tests:
 *
 *   - `MMMM` rendered `0303` for March, because `/MM/g` matched twice over it.
 *   - Lowercase `yyyy` / `dd` passed through literally (`yyyy-03-dd`).
 *
 * All six are reimplemented here on the single-pass tokenizer in
 * `date-tokens.ts`, and every one of them gains OPTIONAL trailing `timezone`
 * and `locale` arguments. Handlebars positional arguments make that purely
 * additive: `{{formatDate v "yyyy-MM-dd"}}` is untouched, while
 * `{{formatDate v "dd MMMM yyyy" "Europe/Paris" "fr-FR"}}` now works.
 *
 * BEHAVIOUR CHANGE, DELIBERATE
 * ----------------------------
 * `MMMM` now renders `March` (or `mars`) instead of `0303`. Garbage became
 * correct; no config can defensibly have depended on the old output, and a
 * repo-wide sweep found the only two shipped `formatDate` call sites both use
 * `"YYYY-MM-DD"`, which is byte-identical under the aliases.
 *
 * THE TOTALITY CONTRACT
 * ---------------------
 * `date-tokens` returns a `DateTokenResult` rather than throwing
 * (`functional/no-throw-statements` is an error in `src/`). Helpers here map a
 * failure to the empty string, matching the contract every other helper in
 * this package already follows: an unresolvable input renders as "", never as
 * a crash, because a malformed automation template must not take down the run.
 *
 * The failure is not swallowed silently — it is logged under the same
 * `DEBUG=sovrium:templates` gate `template-engine.ts` uses, so an author who
 * mistypes a token can see WHY the field came out empty.
 */

import { DateTime, Option } from 'effect'
import {
  formatWithTokens,
  parseWithTokens,
  type DateTokenResult,
} from '@/domain/kernel/format/date-tokens'
import { logError } from '@/infrastructure/logging/logger'

// ─── failure surfacing ───────────────────────────────────────────────────

const isTemplateDebug = (): boolean => process.env['DEBUG']?.includes('sovrium:templates') === true

/**
 * Unwrap a `DateTokenResult`, falling back to `fallback` on failure. The
 * failure reason is logged under `DEBUG=sovrium:templates` — the same gate the
 * template engine uses for compile/render errors — so a mistyped pattern is
 * diagnosable rather than merely blank.
 */
const orElse = <A>(result: DateTokenResult<A>, fallback: A, context: string): A => {
  if (result.ok) return result.value
  if (isTemplateDebug()) {
    logError(`[templates] ${context}`, new Error(result.error.message), {
      code: result.error.code,
    })
  }
  return fallback
}

// ─── instant handling ────────────────────────────────────────────────────

const DEFAULT_TIMEZONE = 'UTC'

/**
 * Read a helper argument as an instant. Accepts an ISO string, an epoch
 * number, or a `Date`; anything unparseable yields `undefined` so callers can
 * apply the empty-string contract.
 */
export const toInstant = (value: unknown): Readonly<Date> | undefined => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value
  if (typeof value === 'number') {
    const fromEpoch = new Date(value)
    return Number.isNaN(fromEpoch.getTime()) ? undefined : fromEpoch
  }
  if (typeof value !== 'string' || value === '') return undefined
  const parsed = DateTime.make(value)
  return Option.isNone(parsed) ? undefined : DateTime.toDateUtc(parsed.value)
}

/** Current instant — the single clock read shared by `now` / `today`. */
export const isoNow = (): string => new Date().toISOString()

// ─── format ──────────────────────────────────────────────────────────────

/**
 * `{{formatDate value pattern [timezone] [locale]}}`
 *
 * Renders `value` through the closed LDML token set. Unparseable input, an
 * unknown token, a bad zone or a bad locale all render as "".
 */
export const formatDate = (
  value: unknown,
  pattern: string,
  timezone?: string,
  locale?: string
): string => {
  const instant = toInstant(value)
  if (instant === undefined) return ''
  return orElse(
    formatWithTokens(instant, pattern, {
      timezone: timezone ?? DEFAULT_TIMEZONE,
      ...(locale === undefined ? {} : { locale }),
    }),
    '',
    `formatDate("${pattern}")`
  )
}

/**
 * `{{parseDate input pattern [timezone]}}`
 *
 * Reads a wall-clock string through the same token set and returns an ISO 8601
 * instant, so it composes with every other date helper:
 * `{{formatDate (parseDate "15/03/2026" "dd/MM/yyyy") "yyyy-MM-dd"}}`.
 */
export const parseDate = (input: unknown, pattern: string, timezone?: string): string => {
  const text = typeof input === 'string' ? input : ''
  if (text === '') return ''
  const parsed = parseWithTokens(text, pattern, { timezone: timezone ?? DEFAULT_TIMEZONE })
  const instant = orElse<Date | undefined>(parsed, undefined, `parseDate("${pattern}")`)
  return instant === undefined ? '' : instant.toISOString()
}

// ─── arithmetic ──────────────────────────────────────────────────────────

/** Units `{{add*}}` / `{{subtract*}}` shift by, mapped to Effect's plural names. */
export type ShiftUnit = 'minutes' | 'hours' | 'days' | 'months' | 'years'

/**
 * Shift an instant by a signed amount and return a new ISO string. The ISO
 * round-trip is deliberate: the result must survive the Handlebars helper
 * boundary as a scalar so it can nest — `{{formatDate (addDays x 30) "…"}}`.
 *
 * A non-finite amount or an unparseable instant returns the input unchanged,
 * preserving the original helper's behaviour.
 */
export const shiftDate = (value: unknown, amount: number, unit: ShiftUnit): string => {
  const instant = toInstant(value)
  if (instant === undefined || !Number.isFinite(amount)) return toStrOrEmpty(value)
  const utc = DateTime.make(instant)
  if (Option.isNone(utc)) return toStrOrEmpty(value)
  return DateTime.toDateUtc(DateTime.add(utc.value, { [unit]: amount })).toISOString()
}

/** Local echo of the input for the "cannot shift" branch. */
const toStrOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '')

// ─── truncation ──────────────────────────────────────────────────────────

/** Units `{{startOf}}` / `{{endOf}}` accept, mirroring Effect's singular names. */
const TRUNCATION_UNITS = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'] as const
type TruncationUnit = (typeof TRUNCATION_UNITS)[number]

const asTruncationUnit = (unit: string): TruncationUnit | undefined =>
  TRUNCATION_UNITS.find((candidate) => candidate === unit)

/**
 * `{{startOf value unit [timezone]}}` / `{{endOf value unit [timezone]}}`
 *
 * Truncation happens in `timezone`, not UTC — "start of day in Europe/Paris"
 * is the question an operator actually asks, and answering it in UTC would be
 * off by the offset for most of the world.
 */
export const boundaryOf = (
  value: unknown,
  unit: string,
  timezone: string | undefined,
  edge: 'start' | 'end'
): string => {
  const instant = toInstant(value)
  const truncation = asTruncationUnit(unit)
  if (instant === undefined || truncation === undefined) return ''
  const utc = DateTime.make(instant)
  if (Option.isNone(utc)) return ''
  const zoned = DateTime.setZoneNamed(utc.value, timezone ?? DEFAULT_TIMEZONE)
  if (Option.isNone(zoned)) return ''
  const moved =
    edge === 'start'
      ? DateTime.startOf(zoned.value, truncation)
      : DateTime.endOf(zoned.value, truncation)
  return new Date(DateTime.toEpochMillis(moved)).toISOString()
}

// ─── weekday ─────────────────────────────────────────────────────────────

/**
 * English short weekday, used INTERNALLY by the weekday predicates. The locale
 * is pinned to `en-US` on purpose: a predicate whose answer depended on the
 * host locale would be machine-dependent, which is exactly the class of bug
 * `date-tokens` pins its own default locale to avoid.
 */
const shortWeekdayEn = (instant: Readonly<Date>, timezone: string): string | undefined => {
  const formatted = formatWithTokens(instant, 'EEE', { timezone, locale: 'en-US' })
  return formatted.ok ? formatted.value : undefined
}

const WEEKEND_DAYS: ReadonlySet<string> = new Set(['Sat', 'Sun'])

/**
 * `{{isWeekend value [timezone]}}` / `{{isWeekday value [timezone]}}`
 *
 * Returns `false` for an unparseable input rather than throwing. Note the
 * asymmetry that implies: for a bad input BOTH predicates answer `false`, so
 * they are not strict complements. That is deliberate — inventing an answer
 * for a date that could not be read would be worse than declining both.
 */
export const isWeekend = (value: unknown, timezone?: string): boolean => {
  const instant = toInstant(value)
  if (instant === undefined) return false
  const day = shortWeekdayEn(instant, timezone ?? DEFAULT_TIMEZONE)
  return day !== undefined && WEEKEND_DAYS.has(day)
}

export const isWeekday = (value: unknown, timezone?: string): boolean => {
  const instant = toInstant(value)
  if (instant === undefined) return false
  const day = shortWeekdayEn(instant, timezone ?? DEFAULT_TIMEZONE)
  return day !== undefined && !WEEKEND_DAYS.has(day)
}

/**
 * `{{dayOfWeek value [timezone] [locale]}}` — the localised FULL weekday name
 * ("Monday" / "lundi"), not a number. A name is what a template interpolates
 * into prose; a caller who wants the ordinal can compare the name or use
 * `{{formatDate v "EEE"}}`.
 */
export const dayOfWeek = (value: unknown, timezone?: string, locale?: string): string =>
  formatDate(value, 'EEEE', timezone, locale)

// ─── epoch ───────────────────────────────────────────────────────────────

/**
 * `{{timestamp value}}` — epoch MILLISECONDS, matching `Date.now()` and the
 * rest of the JavaScript surface an author is likely composing against.
 * Unparseable input yields "" rather than `NaN`, per the package contract.
 */
export const timestamp = (value: unknown): number | string => {
  const instant = toInstant(value)
  return instant === undefined ? '' : instant.getTime()
}

/** `{{fromTimestamp millis}}` — inverse of `{{timestamp}}`, yielding ISO 8601. */
export const fromTimestamp = (value: unknown): string => {
  const millis = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(millis)) return ''
  const instant = new Date(millis)
  return Number.isNaN(instant.getTime()) ? '' : instant.toISOString()
}

// ─── diff ────────────────────────────────────────────────────────────────

/**
 * `{{dateDiff a b}}` — whole days between two instants (a − b). Preserved from
 * the original implementation, including its `0` fallback for unreadable
 * input.
 */
export const dateDiffInDays = (a: unknown, b: unknown): number => {
  const left = toInstant(a)
  const right = toInstant(b)
  if (left === undefined || right === undefined) return 0
  return Math.round((left.getTime() - right.getTime()) / 86_400_000)
}
