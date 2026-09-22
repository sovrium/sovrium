/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure helpers behind the `date/*` action handlers.
 *
 * Split out of `date.ts` for one reason: everything here is a total function
 * over plain values, so it is testable without a run loop, a server or a
 * clock — whereas `date.ts` is eight thin `Effect.sync` wrappers whose only
 * job is prop plumbing. Mirrors the `file.ts` / `file-support.ts` split.
 *
 * ── Why the handlers re-validate props the schema already constrains ────────
 *
 * `context.actions.date.format({...})` inside a `code` action reaches the
 * handler through `buildActionsProxy` → `buildNativeActionInvoker`
 * (`run/action-invokers.ts`), which gates ONLY on registry membership and then
 * synthesises `props: props ?? {}` and dispatches. Nothing decodes those props
 * against `DateFormatActionSchema`. So the struct-level `Schema.check`s in
 * `domain/models/app/automations/actions/date/*` protect DECLARED config only,
 * and every guard they express — a resolvable timezone, a present pattern, a
 * non-empty duration — has to exist here as well or the code-action path
 * reaches the calculator with anything at all.
 */

import { DateTime, Duration, Option } from 'effect'
import { isValidTimezone } from '@/domain/models/app/automations/actions/date/props'
import type { DateTokenErrorCode } from '@/domain/kernel/format/date-tokens'

/**
 * `Either`-shaped carrier, matching `DateTokenResult` in
 * `domain/services/date-tokens.ts` so the two compose without an adapter.
 * `functional/no-throw-statements` is an ERROR in `src/`, so nothing here
 * throws.
 */
export type Resolved<A> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: string }

const ok = <A>(value: A): Resolved<A> => ({ ok: true, value })
const bad = <A>(error: string): Resolved<A> => ({ ok: false, error })

/** Zone assumed when `props.timezone` is absent. Matches the cron trigger. */
export const DEFAULT_TIMEZONE = 'UTC'

/** ISO 8601 rendering of an epoch-millisecond instant. */
export const isoOf = (epochMillis: number): string => new Date(epochMillis).toISOString()

/** `props` as a plain bag; absent props are an empty object, not a crash. */
export const propsOf = (
  action: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

/**
 * A present, non-blank string prop, or `undefined`.
 *
 * Blank is folded into absent deliberately: an unresolved template
 * (`{{steps.x.y}}` against a missing step) substitutes to `''`, and treating
 * that as a real pattern or zone would produce a confusing downstream error
 * instead of the "required prop missing" the author needs to read.
 */
export const optionalString = (
  props: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const raw = props[key]
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
}

/**
 * Resolve and VALIDATE `props.timezone`, defaulting to UTC.
 *
 * Uses the same `isValidTimezone` the schemas' `Schema.check` uses, so a zone
 * spelling accepted in declared config is accepted from a code action and vice
 * versa. Note it is wider than IANA — fixed offsets (`+02:00`) resolve — which
 * is intentional parity with `automations/trigger/cron.ts`.
 */
export const resolveTimezone = (
  props: Readonly<Record<string, unknown>>,
  operator: string
): Resolved<string> => {
  const raw = optionalString(props, 'timezone')
  if (raw === undefined) return ok(DEFAULT_TIMEZONE)
  return isValidTimezone(raw) ? ok(raw) : bad(`date.${operator}: invalid IANA timezone "${raw}"`)
}

/**
 * Read an instant prop.
 *
 * Accepts an ISO 8601 string (the declared shape), a `Date` and an epoch
 * number — the latter two because a template can resolve a record field to
 * either before the handler sees it.
 *
 * An unreadable instant FAILS the step rather than being reported as data:
 * `format`, `add`, `diff` and the boundaries all have a single-value output
 * with nowhere to put a verdict. `parse` is the one operator with a validity
 * channel, and it does not come through here.
 */
export const resolveInstant = (
  props: Readonly<Record<string, unknown>>,
  key: string,
  operator: string
): Resolved<Date> => {
  const raw = props[key]
  const candidate =
    raw instanceof Date
      ? raw
      : typeof raw === 'number' && Number.isFinite(raw)
        ? new Date(raw)
        : undefined
  if (candidate !== undefined) {
    return Number.isNaN(candidate.getTime())
      ? bad(`date.${operator}: \`${key}\` is not a readable instant`)
      : ok(candidate)
  }
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text === '') return bad(`date.${operator} requires \`${key}\``)
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime())
    ? bad(`date.${operator}: \`${key}\` is not a readable instant: "${text}"`)
    : ok(parsed)
}

/**
 * View `instant` in `timezone`.
 *
 * The zone was already validated by {@link resolveTimezone}, so a `None` here
 * is a genuine surprise rather than an author error — it is still surfaced
 * rather than defaulted, because silently computing in UTC is how a report
 * ends up an hour wrong every day.
 */
export const zonedAt = (
  instant: Readonly<Date>,
  timezone: string,
  operator: string
): Resolved<DateTime.Zoned> => {
  const utc = DateTime.make(instant)
  if (Option.isNone(utc)) return bad(`date.${operator}: cannot read an Invalid Date`)
  const zoned = DateTime.setZoneNamed(utc.value, timezone)
  return Option.isNone(zoned)
    ? bad(`date.${operator}: invalid IANA timezone "${timezone}"`)
    : ok(zoned.value)
}

// ─── duration components (add / subtract) ────────────────────────────────

/** Units `DateTime.add` resolves against the CALENDAR, so DST-sensitive. */
export const CALENDAR_DURATION_KEYS = ['years', 'months', 'weeks', 'days'] as const

/**
 * Units treated as FIXED lengths, carried as an `Effect.Duration` of elapsed
 * time rather than as a wall-clock part.
 *
 * This is a deliberate divergence from `DateTime.add`, which applies EVERY
 * component as wall-clock arithmetic on a zoned value — measured on Effect
 * 4.0.0-rc.108: `DateTime.add(parisNoon, { hours: 24 })` on `2026-03-28T12:00Z`
 * lands 23 real hours later, exactly as `{ days: 1 }` does. The shipped contract
 * says otherwise in two places: `add.ts` documents `timezone` as determining
 * "DST behaviour for day-and-larger units", and `diff.ts` states that "hour and
 * below are fixed-length and ignore the zone entirely". Honouring that keeps one
 * meaning of "an hour" across the whole action type — `add` and `diff` must
 * agree, or `add: { hours: 3 }` followed by `diff` in `hour` can return 2.
 *
 * Effect ships BOTH halves of that split and neither alone is it:
 * `DateTime.add` is the wall-clock one, `DateTime.addDuration` the fixed-elapsed
 * one. So the split is a COMPOSITION of the two (see {@link shiftInstant}), and
 * these entries are `Duration` constructors rather than a millisecond table.
 */
const FIXED_DURATION_OF: Readonly<Record<string, (amount: number) => Duration.Duration>> = {
  hours: Duration.hours,
  minutes: Duration.minutes,
  seconds: Duration.seconds,
}

const DURATION_KEYS: readonly string[] = [
  ...CALENDAR_DURATION_KEYS,
  ...Object.keys(FIXED_DURATION_OF),
]

/**
 * Collect the declared duration components.
 *
 * An EMPTY duration is rejected, mirroring the schemas' own `Schema.check`: a
 * misspelled unit key is dropped by the decoder (and never even reaches the
 * decoder on the code-action path), so accepting it would return the input
 * unchanged and surface only as wrong data much later.
 */
export const resolveDuration = (
  props: Readonly<Record<string, unknown>>,
  operator: string
): Resolved<Readonly<Record<string, number>>> => {
  const declared = DURATION_KEYS.flatMap((key) => {
    const raw = props[key]
    if (raw === undefined || raw === null || raw === '') return []
    return [[key, typeof raw === 'number' ? raw : Number(raw)] as const]
  })
  const invalid = declared.find(([, value]) => !Number.isInteger(value))
  if (invalid !== undefined) {
    return bad(`date.${operator}: \`${invalid[0]}\` must be a whole number`)
  }
  if (declared.length === 0) {
    return bad(
      `date.${operator} requires at least one duration component ` +
        `(years, months, weeks, days, hours, minutes or seconds)`
    )
  }
  return ok(Object.fromEntries(declared))
}

/**
 * Apply a signed duration: calendar components through the zoned calendar,
 * fixed components as elapsed time. Returns the epoch instant.
 *
 * The two halves are Effect's own two shift primitives, composed:
 * `DateTime.add` resolves parts against the zoned CALENDAR (so a Paris day
 * across spring-forward is 23 hours), and `DateTime.addDuration` adds a fixed
 * ELAPSED `Duration` (so an hour is always 3 600 000 ms, whatever the zone is
 * doing). Applying the calendar half first matters: it is what makes the
 * documented "larger units before smaller" clamping — 31 January + 1 month
 * lands on 28 February before any hours are applied — fall out of the order
 * rather than needing to be arranged.
 *
 * `subtractDuration` on the negative path rather than negating the `Duration`:
 * both work on Effect 4, whose `Duration` is signed (`Duration.hours(-2)` is
 * -7 200 000 ms — verified on 4.0.0-rc.108, `Duration.hours = (h) => make(h *
 * 3_600_000)`, no clamp). Dispatching keeps the sign in ONE place instead of
 * threading it through every constructor call, and names the inverse operation
 * that Effect itself exports for it.
 */
export const shiftInstant = (input: {
  readonly zoned: DateTime.Zoned
  readonly duration: Readonly<Record<string, number>>
  readonly sign: 1 | -1
}): number => {
  const calendar = Object.fromEntries(
    CALENDAR_DURATION_KEYS.filter((key) => input.duration[key] !== undefined).map((key) => [
      key,
      input.sign * (input.duration[key] as number),
    ])
  )
  const shifted = DateTime.add(input.zoned, calendar)
  const elapsed = Object.entries(FIXED_DURATION_OF).reduce(
    (acc, [key, of]) => Duration.sum(acc, of(input.duration[key] ?? 0)),
    Duration.zero
  )
  return DateTime.toEpochMillis(
    input.sign > 0
      ? DateTime.addDuration(shifted, elapsed)
      : DateTime.subtractDuration(shifted, elapsed)
  )
}

// ─── diff ────────────────────────────────────────────────────────────────

/** Units whose length is fixed, so the zone cannot change the answer. */
export const FIXED_DIFF_UNIT_MS: Readonly<Record<string, number>> = {
  millisecond: 1,
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
}

/** Diff units that must be counted against a calendar, keyed to their
 *  `DateTime.PartsForMath` plural. */
export const CALENDAR_DIFF_UNITS: Readonly<Record<string, string>> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
  year: 'years',
}

const MS_PER_DAY = 86_400_000

/** Days since the epoch of a LOCAL calendar date — the estimate anchor for
 *  `day`/`week`, which is exact except at a DST boundary. */
const localDayIndex = (zoned: Readonly<DateTime.Zoned>): number => {
  const parts = DateTime.toParts(zoned)
  return Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY
}

/**
 * First guess at how many whole `unit`s separate the two instants.
 *
 * Derived from CALENDAR parts rather than from elapsed milliseconds so the
 * guess is off by at most one regardless of span — a millisecond-ratio guess
 * for `month` drifts ~3%, which is 36 months wrong over a century and would
 * need an unbounded correction search.
 */
const estimateUnits = (
  from: Readonly<DateTime.Zoned>,
  to: Readonly<DateTime.Zoned>,
  unit: string
): number => {
  const fromParts = DateTime.toParts(from)
  const toParts = DateTime.toParts(to)
  if (unit === 'year') return Math.abs(toParts.year - fromParts.year)
  if (unit === 'month') {
    return Math.abs((toParts.year - fromParts.year) * 12 + (toParts.month - fromParts.month))
  }
  const days = Math.abs(localDayIndex(to) - localDayIndex(from))
  return unit === 'week' ? Math.floor(days / 7) : days
}

/** Correction budget around {@link estimateUnits}. The estimate is off by at
 *  most one, so 8 is generous; it exists to bound the recursion, not to
 *  converge. */
const CORRECTION_FUEL = 8

interface CountInput {
  readonly from: DateTime.Zoned
  readonly toMillis: number
  readonly plural: string
  readonly sign: 1 | -1
}

/**
 * Largest `magnitude` such that shifting `from` by `sign * magnitude` units
 * does not pass `toMillis`.
 *
 * A linear correction rather than arithmetic because the predicate is monotone
 * but the unit length is not constant: across a Paris spring-forward a "day" is
 * 23 hours, so 47 elapsed hours can be two whole calendar days there and only
 * one in UTC. Counting is the only way to get that right.
 */
const countWholeUnits = (input: CountInput, magnitude: number, fuel: number): number => {
  const fits = (candidate: number): boolean => {
    const reached = DateTime.toEpochMillis(
      DateTime.add(input.from, { [input.plural]: input.sign * candidate })
    )
    return input.sign > 0 ? reached <= input.toMillis : reached >= input.toMillis
  }
  if (fuel <= 0) return magnitude
  if (magnitude > 0 && !fits(magnitude)) return countWholeUnits(input, magnitude - 1, fuel - 1)
  if (fits(magnitude + 1)) return countWholeUnits(input, magnitude + 1, fuel - 1)
  return magnitude
}

/**
 * Signed, zero-truncated distance from `from` to `to`, expressed in `unit`.
 *
 * Sign is `to` minus `from` — an automation asking "is this overdue" needs it,
 * and a lost sign cannot be recovered downstream.
 */
export const diffInUnits = (input: {
  readonly from: Readonly<Date>
  readonly to: Readonly<Date>
  readonly fromZoned: DateTime.Zoned
  readonly toZoned: DateTime.Zoned
  readonly unit: string
}): number => {
  const deltaMillis = input.to.getTime() - input.from.getTime()
  const fixed = FIXED_DIFF_UNIT_MS[input.unit]
  if (fixed !== undefined) return Math.trunc(deltaMillis / fixed)

  const sign = deltaMillis < 0 ? -1 : 1
  const plural = CALENDAR_DIFF_UNITS[input.unit] as string
  const magnitude = countWholeUnits(
    { from: input.fromZoned, toMillis: input.to.getTime(), plural, sign },
    estimateUnits(input.fromZoned, input.toZoned, input.unit),
    CORRECTION_FUEL
  )
  return sign * magnitude
}

// ─── pattern-error classification ────────────────────────────────────────

/**
 * Error codes that mean the PATTERN (or zone) is wrong — an author mistake, so
 * the step fails — as opposed to the INPUT being unreadable, which for
 * `date:parse` is a fact about the data and is reported as `valid: false`.
 *
 * Enumerated by inclusion rather than by exclusion so a token-set wave that
 * adds a new code has to classify it on purpose; defaulting an unknown code to
 * "data" would silently turn a new author error into a green step.
 */
const PATTERN_SIDE_CODES: ReadonlySet<DateTokenErrorCode> = new Set<DateTokenErrorCode>([
  'unknown-token',
  'unterminated-quote',
  'pattern-too-long',
  'unparseable-token',
  'invalid-timezone',
])

export const isPatternAuthorError = (code: DateTokenErrorCode): boolean =>
  PATTERN_SIDE_CODES.has(code)
