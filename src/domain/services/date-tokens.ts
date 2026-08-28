/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Timezone- and locale-aware date formatting/parsing over a CLOSED token set.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Handlebars date helpers (`infrastructure/templates/handlebars-helpers.ts`)
 * format dates by running six sequential global string replaces over the
 * pattern (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`), always in UTC. That approach
 * has two structural defects a replace-chain cannot fix:
 *
 *  - `MMMM` renders `0303` for March, because `/MM/g` matches twice over it.
 *  - Lowercase `yyyy` / `dd` pass through LITERALLY, so `yyyy-MM-dd` renders
 *    `yyyy-03-dd`.
 *
 * Both are empirically reproduced in the co-located test file. This module
 * replaces the replace-chain with a real single-pass tokenizer and adds the
 * timezone/locale awareness nothing in the codebase currently offers.
 *
 * WHY NOT A DATE LIBRARY
 * ----------------------
 * Vendoring `date-fns` was considered and rejected. The machinery already
 * exists and is already trusted: `Effect.DateTime` does zone conversion (and
 * is already boot-validated for IANA zones in `automations/trigger/cron.ts`),
 * and `Intl.DateTimeFormat` does locale names (already used in
 * `use-cases/tables/utils/display-formatter.ts`). What was missing was a
 * tokenizer, which is this file.
 *
 * THE CLOSED-SET POLICY (load-bearing)
 * ------------------------------------
 * The token vocabulary is CLOSED. An unrecognised token is a returned FAILURE,
 * never a silent pass-through. This is what makes hand-rolling defensible: the
 * moment we imply the full ~40-token vocabulary of a real date library, we owe
 * users all of it. With a closed set the surface is finite and testable.
 *
 * Concretely: every ASCII letter outside a quoted literal must belong to a
 * recognised token. That is LDML's own rule — letters are reserved, and a
 * literal letter must be quoted (`'at'`). Non-letters (`-`, `/`, `:`, space)
 * are literals and pass through untouched.
 *
 * VOCABULARY: UNICODE LDML, WITH LEGACY ALIASES
 * ---------------------------------------------
 * Canonical tokens are Unicode LDML (`yyyy`, `MM`, `dd`, ...). The legacy
 * `YYYY` and `DD` are kept as ALIASES producing byte-identical output.
 *
 * Note that in real LDML, `YYYY` means ISO week-numbering year and `DD` means
 * day-of-year — so the existing helper's use of them for calendar year and
 * day-of-month is ALREADY non-standard. Aliasing moves the vocabulary to the
 * standard while preserving every existing config byte-for-byte. A repo-wide
 * sweep of `formatDate` call sites at the time of writing found zero lowercase
 * `yyyy`/`dd` usages, so adopting lowercase as canonical breaks nothing.
 *
 * NO THROWING
 * -----------
 * `functional/no-throw-statements` is an ERROR in `src/`, and an automation
 * must never be crashed by a misconfigured pattern. Both entry points
 * therefore return a `DateTokenResult`. The distinction they encode:
 * a bad PATTERN is an author error, a bad INPUT is data — both are surfaced,
 * neither is swallowed. Callers decide the fallback.
 *
 * Pure domain: no DB, no I/O, no Effect runtime. `Effect.DateTime` is used
 * only as a pure calendar/zone calculator.
 */

import { DateTime, Option, Result } from 'effect'

// ─── result + error types ────────────────────────────────────────────────

/** Why a format/parse call could not produce a value. */
export type DateTokenErrorCode =
  /** A letter outside a quoted literal that is not part of a known token. */
  | 'unknown-token'
  /** A `'`-quoted literal was never closed. */
  | 'unterminated-quote'
  /** Pattern exceeds `MAX_PATTERN_LENGTH` (guards the recursive scanner). */
  | 'pattern-too-long'
  /** `timezone` is not a valid IANA identifier. */
  | 'invalid-timezone'
  /** `locale` is not a valid BCP 47 tag. */
  | 'invalid-locale'
  /** The instant handed to `formatWithTokens` is an Invalid Date. */
  | 'invalid-instant'
  /** A locale-name token (`MMMM`/`MMM`/`EEEE`/`EEE`) was used in a pattern
   *  handed to `parseWithTokens`, which reads numeric tokens only. */
  | 'unparseable-token'
  /** Input did not match the pattern's literal text or digit widths. */
  | 'input-mismatch'
  /** A numeric field parsed but fell outside its valid range. */
  | 'out-of-range'
  /** Fields were individually in range but do not name a real calendar day
   *  (e.g. 30 February). */
  | 'invalid-date'

/** A machine-readable code plus a message meant for a config author. */
export interface DateTokenError {
  readonly code: DateTokenErrorCode
  readonly message: string
}

/** `Either`-like carrier. `ok` discriminates; no exceptions are ever thrown. */
export type DateTokenResult<A> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: DateTokenError }

const succeed = <A>(value: A): DateTokenResult<A> => ({ ok: true, value })

const fail = <A>(code: DateTokenErrorCode, message: string): DateTokenResult<A> => ({
  ok: false,
  error: { code, message },
})

// ─── the closed token set ────────────────────────────────────────────────

/** One entry of the closed vocabulary. Exported shape so docs and a drift
 *  check can render the table from the single source of truth. */
export interface DateToken {
  /** The literal token text as written in a pattern. */
  readonly token: string
  /** Human description, suitable for a docs table. */
  readonly description: string
  /** Whether `parseWithTokens` can read this token back. Locale NAME tokens
   *  are format-only: `mars` is ambiguous across locales and abbreviation
   *  styles, so accepting it on the parse side would be guesswork. */
  readonly parseable: boolean
  /** Set when this token is a legacy spelling of another (identical output). */
  readonly aliasOf?: string
}

/**
 * THE closed vocabulary. Nothing outside this list is a token.
 */
export const TOKENS: readonly DateToken[] = [
  { token: 'yyyy', description: 'Calendar year, 4 digits (2026)', parseable: true },
  { token: 'YYYY', description: 'Legacy alias of yyyy', parseable: true, aliasOf: 'yyyy' },
  { token: 'MM', description: 'Month, 2 digits (01-12)', parseable: true },
  { token: 'dd', description: 'Day of month, 2 digits (01-31)', parseable: true },
  { token: 'DD', description: 'Legacy alias of dd', parseable: true, aliasOf: 'dd' },
  { token: 'HH', description: 'Hour, 2 digits, 24-hour (00-23)', parseable: true },
  { token: 'mm', description: 'Minute, 2 digits (00-59)', parseable: true },
  { token: 'ss', description: 'Second, 2 digits (00-59)', parseable: true },
  { token: 'MMMM', description: 'Month name, full, localised (March / mars)', parseable: false },
  { token: 'MMM', description: 'Month name, short, localised (Mar / mars)', parseable: false },
  { token: 'EEEE', description: 'Weekday name, full, localised (Saturday)', parseable: false },
  { token: 'EEE', description: 'Weekday name, short, localised (Sat)', parseable: false },
]

/** Canonical spelling for a token (resolves the legacy aliases). */
const CANONICAL: Readonly<Record<string, string>> = Object.fromEntries(
  TOKENS.map((t) => [t.token, t.aliasOf ?? t.token])
)

/**
 * Token texts, LONGEST FIRST. Order is load-bearing: `MMMM` must be tried
 * before `MMM` before `MM`, else `MMMM` tokenises as two `MM`s — which is
 * precisely the `0303` bug this module exists to fix.
 */
const TOKEN_TEXTS: readonly string[] = TOKENS.map((t) => t.token)

const TOKENS_LONGEST_FIRST: readonly string[] = TOKEN_TEXTS.toSorted((a, b) => b.length - a.length)

const PARSEABLE: Readonly<Record<string, boolean>> = Object.fromEntries(
  TOKENS.map((t) => [t.token, t.parseable])
)

/** Bounds the recursive scanner. Patterns are short author-written config. */
const MAX_PATTERN_LENGTH = 200

// ─── tokenizer ───────────────────────────────────────────────────────────

/** A pattern compiles to an ordered list of these. */
export type Segment =
  | { readonly kind: 'token'; readonly token: string }
  | { readonly kind: 'literal'; readonly text: string }

const IS_LETTER = /[A-Za-z]/

/** Longest-first token match at `index`, or undefined. */
const tokenAt = (pattern: string, index: number): string | undefined =>
  TOKENS_LONGEST_FIRST.find((token) => pattern.startsWith(token, index))

/** Consume a `'`-quoted literal beginning at `index`. `''` yields one quote. */
const quotedAt = (
  pattern: string,
  index: number
): DateTokenResult<{ readonly text: string; readonly next: number }> => {
  if (pattern[index + 1] === "'") return succeed({ text: "'", next: index + 2 })
  const close = pattern.indexOf("'", index + 1)
  if (close === -1) {
    return fail(
      'unterminated-quote',
      `Unterminated quoted literal starting at position ${index} in "${pattern}"`
    )
  }
  return succeed({ text: pattern.slice(index + 1, close), next: close + 1 })
}

/**
 * Single left-to-right pass over the pattern. Recursive rather than looping
 * because `functional/no-let` is an error and the scanner needs no mutation.
 */
const scan = (
  pattern: string,
  index: number,
  acc: readonly Segment[]
): DateTokenResult<readonly Segment[]> => {
  if (index >= pattern.length) return succeed(acc)

  const char = pattern[index] as string

  if (char === "'") {
    const quoted = quotedAt(pattern, index)
    if (!quoted.ok) return quoted
    return scan(pattern, quoted.value.next, [...acc, { kind: 'literal', text: quoted.value.text }])
  }

  const token = tokenAt(pattern, index)
  if (token !== undefined) {
    return scan(pattern, index + token.length, [...acc, { kind: 'token', token }])
  }

  // The closed-set rule: a bare letter is never a literal.
  if (IS_LETTER.test(char)) {
    return fail(
      'unknown-token',
      `Unknown date token "${char}" at position ${index} in "${pattern}". ` +
        `Known tokens: ${TOKENS.map((t) => t.token).join(', ')}. ` +
        `To emit a literal letter, quote it (e.g. 'at').`
    )
  }

  return scan(pattern, index + 1, [...acc, { kind: 'literal', text: char }])
}

/**
 * Compile a pattern into segments. Exported for the sibling waves that will
 * validate author patterns at config-decode time without formatting anything.
 */
export const tokenizePattern = (pattern: string): DateTokenResult<readonly Segment[]> =>
  pattern.length > MAX_PATTERN_LENGTH
    ? fail(
        'pattern-too-long',
        `Date pattern exceeds ${MAX_PATTERN_LENGTH} characters (got ${pattern.length})`
      )
    : scan(pattern, 0, [])

// ─── shared option handling ──────────────────────────────────────────────

/** Zone/locale inputs. Both default so callers may pass nothing. */
export interface FormatOptions {
  /** IANA timezone. Default `'UTC'`, matching the cron trigger's default. */
  readonly timezone?: string
  /** BCP 47 tag driving the NAME tokens. Default `'en-US'` — chosen for
   *  determinism; the host's locale would make output machine-dependent. */
  readonly locale?: string
}

export interface ParseOptions {
  /** IANA timezone the wall-clock input is expressed in. Default `'UTC'`. */
  readonly timezone?: string
}

const DEFAULT_TIMEZONE = 'UTC'
const DEFAULT_LOCALE = 'en-US'

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

/** Wall-clock fields of `instant` as seen in `timezone`. */
interface ZonedParts {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly second: number
}

const zonedPartsOf = (instant: Readonly<Date>, timezone: string): DateTokenResult<ZonedParts> => {
  const utc = DateTime.make(instant)
  if (Option.isNone(utc)) {
    return fail('invalid-instant', 'Cannot format an Invalid Date')
  }
  const zoned = DateTime.setZoneNamed(utc.value, timezone)
  if (Option.isNone(zoned)) {
    return fail('invalid-timezone', `Invalid IANA timezone: ${timezone}`)
  }
  return succeed(DateTime.toParts(zoned.value) as ZonedParts)
}

// ─── format ──────────────────────────────────────────────────────────────

const NUMERIC: Readonly<Record<string, (p: ZonedParts) => string>> = {
  yyyy: (p) => pad(p.year, 4),
  MM: (p) => pad(p.month, 2),
  dd: (p) => pad(p.day, 2),
  HH: (p) => pad(p.hour, 2),
  mm: (p) => pad(p.minute, 2),
  ss: (p) => pad(p.second, 2),
}

const NAME_OPTIONS: Readonly<Record<string, Intl.DateTimeFormatOptions>> = {
  MMMM: { month: 'long' },
  MMM: { month: 'short' },
  EEEE: { weekday: 'long' },
  EEE: { weekday: 'short' },
}

/** Everything a single segment needs in order to render itself. */
interface RenderContext {
  readonly instant: Readonly<Date>
  readonly parts: ZonedParts
  readonly timezone: string
  readonly locale: string
}

/**
 * Localised name for a NAME token. `Intl.DateTimeFormat` throws `RangeError`
 * on a bad locale or zone, so it is wrapped rather than allowed to escape.
 */
const localisedName = (token: string, context: RenderContext): DateTokenResult<string> => {
  const formatted = Result.try({
    try: () =>
      new Intl.DateTimeFormat(context.locale, {
        ...(NAME_OPTIONS[token] as Intl.DateTimeFormatOptions),
        timeZone: context.timezone,
      }).format(context.instant),
    catch: (cause) => cause,
  })
  return Result.isSuccess(formatted)
    ? succeed(formatted.success)
    : fail('invalid-locale', `Invalid locale "${context.locale}" for token "${token}"`)
}

const renderSegment = (segment: Segment, context: RenderContext): DateTokenResult<string> => {
  if (segment.kind === 'literal') return succeed(segment.text)
  const canonical = CANONICAL[segment.token] as string
  const numeric = NUMERIC[canonical]
  return numeric === undefined ? localisedName(canonical, context) : succeed(numeric(context.parts))
}

/**
 * Render `instant` through `pattern`, in `timezone`, naming months/weekdays in
 * `locale`.
 *
 * Fails (never throws) on an unknown token, an unterminated quote, an invalid
 * zone or locale, or an Invalid Date.
 */
export const formatWithTokens = (
  instant: Readonly<Date>,
  pattern: string,
  options: FormatOptions = {}
): DateTokenResult<string> => {
  const timezone = options.timezone ?? DEFAULT_TIMEZONE
  const locale = options.locale ?? DEFAULT_LOCALE

  const segments = tokenizePattern(pattern)
  if (!segments.ok) return segments

  const parts = zonedPartsOf(instant, timezone)
  if (!parts.ok) return parts

  const context: RenderContext = { instant, parts: parts.value, timezone, locale }

  return segments.value.reduce<DateTokenResult<string>>((acc, segment) => {
    if (!acc.ok) return acc
    const rendered = renderSegment(segment, context)
    return rendered.ok ? succeed(acc.value + rendered.value) : rendered
  }, succeed(''))
}

// ─── parse ───────────────────────────────────────────────────────────────

/** Digit width each parseable token consumes. Widths are FIXED: the patterns
 *  this serves are zero-padded, and variable width makes `ddMM` ambiguous. */
const WIDTHS: Readonly<Record<string, number>> = {
  yyyy: 4,
  MM: 2,
  dd: 2,
  HH: 2,
  mm: 2,
  ss: 2,
}

const RANGES: Readonly<Record<string, readonly [number, number]>> = {
  yyyy: [0, 9999],
  MM: [1, 12],
  dd: [1, 31],
  HH: [0, 23],
  mm: [0, 59],
  ss: [0, 59],
}

/** Accumulated numeric fields, keyed by canonical token. */
type Fields = Readonly<Record<string, number>>

const DIGITS_ONLY = /^\d+$/

/** Position of the scanner: where we are in the pattern, in the input, and
 *  what has been read so far. */
interface ScanState {
  readonly position: number
  readonly cursor: number
  readonly fields: Fields
}

const consumeToken = (
  input: string,
  cursor: number,
  canonical: string,
  fields: Fields
): DateTokenResult<{ readonly cursor: number; readonly fields: Fields }> => {
  const width = WIDTHS[canonical] as number
  const slice = input.slice(cursor, cursor + width)
  if (slice.length !== width || !DIGITS_ONLY.test(slice)) {
    return fail(
      'input-mismatch',
      `Expected ${width} digits for "${canonical}" at position ${cursor} in "${input}"`
    )
  }
  const value = Number(slice)
  const [min, max] = RANGES[canonical] as readonly [number, number]
  if (value < min || value > max) {
    return fail('out-of-range', `"${canonical}" value ${value} is outside ${min}-${max}`)
  }
  return succeed({ cursor: cursor + width, fields: { ...fields, [canonical]: value } })
}

const consumeLiteral = (input: string, cursor: number, text: string): DateTokenResult<number> =>
  input.startsWith(text, cursor)
    ? succeed(cursor + text.length)
    : fail('input-mismatch', `Expected literal "${text}" at position ${cursor} in "${input}"`)

const unparseable = <A>(token: string): DateTokenResult<A> =>
  fail(
    'unparseable-token',
    `Token "${token}" is format-only and cannot be parsed. ` +
      `Parseable tokens: ${TOKENS.filter((t) => t.parseable)
        .map((t) => t.token)
        .join(', ')}.`
  )

const consume = (
  input: string,
  segments: readonly Segment[],
  state: ScanState
): DateTokenResult<ScanState> => {
  if (state.position >= segments.length) return succeed(state)
  const segment = segments[state.position] as Segment
  const advance = (cursor: number, fields: Fields): DateTokenResult<ScanState> =>
    consume(input, segments, { position: state.position + 1, cursor, fields })

  if (segment.kind === 'literal') {
    const next = consumeLiteral(input, state.cursor, segment.text)
    return next.ok ? advance(next.value, state.fields) : { ok: false, error: next.error }
  }

  if (PARSEABLE[segment.token] !== true) return unparseable(segment.token)

  const canonical = CANONICAL[segment.token] as string
  const next = consumeToken(input, state.cursor, canonical, state.fields)
  return next.ok ? advance(next.value.cursor, next.value.fields) : { ok: false, error: next.error }
}

/**
 * True when y/m/d name a real calendar day. Necessary because
 * `DateTime.makeZoned` SILENTLY rolls 30 February forward to 2 March rather
 * than rejecting it — verified against Effect 4.
 */
const isRealCalendarDay = (year: number, month: number, day: number): boolean => {
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1
    ? probe.getUTCDate() === day
    : false
}

/**
 * Read `input` as wall-clock time in `timezone` according to `pattern`.
 *
 * Only NUMERIC tokens are accepted; a locale-name token fails with
 * `unparseable-token`. Absent fields default to the start of their period, so
 * `yyyy-MM-dd` yields midnight.
 *
 * A wall time that does not exist because of a DST spring-forward gap (e.g.
 * `2026-03-29 02:30` in `Europe/Paris`) is accepted and normalised forward,
 * matching `Effect.DateTime`'s own behaviour.
 */
/**
 * Turn the read fields into an instant. Absent fields default to the start of
 * their period, so `yyyy-MM-dd` yields midnight.
 */
const instantFromFields = (fields: Fields, timezone: string): DateTokenResult<Date> => {
  const year = fields['yyyy'] ?? 1970
  const month = fields['MM'] ?? 1
  const day = fields['dd'] ?? 1

  if (!isRealCalendarDay(year, month, day)) {
    return fail(
      'invalid-date',
      `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)} is not a real date`
    )
  }

  const zoned = DateTime.makeZoned(
    {
      year,
      month,
      day,
      hour: fields['HH'] ?? 0,
      minute: fields['mm'] ?? 0,
      second: fields['ss'] ?? 0,
      millisecond: 0,
    },
    { timeZone: timezone, adjustForTimeZone: true }
  )

  return Option.isNone(zoned)
    ? fail('invalid-timezone', `Invalid IANA timezone: ${timezone}`)
    : succeed(new Date(DateTime.toEpochMillis(zoned.value)))
}

export const parseWithTokens = (
  input: string,
  pattern: string,
  options: ParseOptions = {}
): DateTokenResult<Date> => {
  const timezone = options.timezone ?? DEFAULT_TIMEZONE

  const segments = tokenizePattern(pattern)
  if (!segments.ok) return segments

  const consumed = consume(input, segments.value, { position: 0, cursor: 0, fields: {} })
  if (!consumed.ok) return consumed

  return consumed.value.cursor === input.length
    ? instantFromFields(consumed.value.fields, timezone)
    : fail(
        'input-mismatch',
        `Unexpected trailing input "${input.slice(consumed.value.cursor)}" in "${input}"`
      )
}
