/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared prop fragments for the `date` action type.
 *
 * The eight date operators repeat three prop shapes — `timezone`, `locale` and
 * `pattern` — plus the calendar-unit vocabularies. They are defined once here
 * rather than copied per operator so the published JSON Schema carries one
 * description per concept, and so widening the unit vocabulary is a one-line
 * change instead of an eight-file sweep.
 *
 * Kept as loose `Schema` values (not a composed struct) because each operator
 * spreads a DIFFERENT subset: `parse` takes no `locale` (locale NAME tokens are
 * format-only — see `TOKENS[].parseable` in `domain/kernel/format/date-tokens.ts`),
 * and `add`/`subtract` take no `pattern` at all.
 */

import { DateTime, Result, Schema } from 'effect'

/**
 * IANA timezone identifier.
 *
 * Validation is deliberately NOT attached here — it is applied per-operator as
 * a struct-level `Schema.check`, mirroring `automations/trigger/cron.ts`, so
 * the failure message can name the operator that carries the bad zone.
 */
export const TimezoneProp = Schema.String.pipe(
  Schema.annotate({
    description:
      'IANA timezone for the calculation (e.g. "Europe/Paris"). Default: "UTC". ' +
      'An instant carries no zone of its own — this is what the instant is READ in. ' +
      'A fixed offset ("+02:00") is also accepted but cannot express DST, so prefer a ' +
      'named zone for anywhere that observes it.',
  })
)

/** BCP 47 locale tag, used only by the locale-name tokens (`MMMM`, `EEEE`, ...). */
export const LocaleProp = Schema.String.pipe(
  Schema.annotate({
    description:
      'BCP 47 locale for month and weekday NAMES (e.g. "fr-FR"). Default: "en-US". ' +
      'Ignored by purely numeric patterns.',
  })
)

/**
 * Format pattern over the CLOSED token set.
 *
 * The vocabulary is the single source of truth in
 * `domain/kernel/format/date-tokens.ts` (`TOKENS`). It is closed on purpose: an
 * unrecognised letter outside a quoted literal is an ERROR, never a silent
 * pass-through, which is what keeps a hand-rolled tokenizer defensible.
 */
export const PatternProp = Schema.String.pipe(
  Schema.annotate({
    description:
      'Format pattern over the closed token set (yyyy, MM, dd, HH, mm, ss, MMMM, MMM, EEEE, EEE, ' +
      'and the legacy aliases YYYY/DD). Quote literal letters: "yyyy-MM-dd\'T\'HH:mm:ss".',
  })
)

/**
 * Calendar unit, SINGULAR everywhere.
 *
 * `diff` reads "difference expressed in the unit day" and `startOf` reads
 * "start of the day" — one vocabulary rather than plural-for-diff /
 * singular-for-boundaries, which is exactly the sort of near-miss that costs a
 * config author a debugging session.
 */
export const CalendarUnitProp = Schema.Literals([
  'year',
  'month',
  'week',
  'day',
  'hour',
  'minute',
  'second',
]).pipe(
  Schema.annotate({
    description: 'Calendar unit (singular): year, month, week, day, hour, minute or second',
  })
)

/** `diff` additionally answers in milliseconds; boundaries do not snap to one. */
export const DiffUnitProp = Schema.Literals([
  'year',
  'month',
  'week',
  'day',
  'hour',
  'minute',
  'second',
  'millisecond',
]).pipe(
  Schema.annotate({
    description:
      'Unit the difference is expressed in (singular): year, month, week, day, hour, minute, ' +
      'second or millisecond',
  })
)

/**
 * Signed duration components shared by `add` and `subtract`.
 *
 * Counts are PLURAL (`days: 7`) because they are quantities, while unit NAMES
 * are singular — the same split Luxon and the Temporal proposal use.
 *
 * `subtract` exists as its own operator rather than being spelled
 * `add: { days: -7 }` because a leading minus inside YAML is a readability trap
 * and the ported code literally reads `subDays(...)`.
 *
 * CALENDAR vs ELAPSED. The two halves do not mean the same thing, and each
 * description says which it is, because the difference is only visible on the
 * two days a year it matters. `years`/`months`/`weeks`/`days` are resolved
 * against the zoned CALENDAR, so a Paris day across spring-forward is 23 real
 * hours and the wall clock is preserved. `hours`/`minutes`/`seconds` are FIXED
 * elapsed time, so an hour is always 3 600 000 ms whatever the zone is doing.
 * That is the same split Temporal and java.time draw, and it is what keeps
 * `add: { hours: 3 }` and a subsequent `diff` in `hour` agreeing. The
 * composition that implements it is `shiftInstant` in
 * `application/use-cases/automations/action-handlers/date-support.ts`.
 */
export const DurationProps = {
  years: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.annotate({
        description: 'Whole years to shift by, on the calendar (DST-aware, wall clock preserved)',
      })
    )
  ),
  months: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.annotate({
        description:
          'Whole months to shift by, on the calendar (DST-aware; 31 Jan + 1 month is 28 Feb)',
      })
    )
  ),
  weeks: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.annotate({
        description: 'Whole weeks to shift by, on the calendar (DST-aware, wall clock preserved)',
      })
    )
  ),
  days: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.annotate({
        description:
          'Whole days to shift by, on the calendar (DST-aware: a day across a DST change is 23 or 25 real hours)',
      })
    )
  ),
  hours: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.annotate({
        description:
          'Whole hours to shift by, as fixed elapsed time (an hour is always 60 minutes)',
      })
    )
  ),
  minutes: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.annotate({
        description: 'Whole minutes to shift by, as fixed elapsed time (unaffected by DST)',
      })
    )
  ),
  seconds: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.annotate({
        description: 'Whole seconds to shift by, as fixed elapsed time (unaffected by DST)',
      })
    )
  ),
}

/**
 * Does `timezone` name a zone Effect can resolve?
 *
 * Wider than "IANA": fixed offsets (`+02:00`, `+0200`, `-05:00`) resolve too,
 * while `GMT+2`, `UTC+2`, `Z` and `Local` do not. The exact accepted set is
 * pinned in the co-located test. Kept identical to
 * `automations/trigger/cron.ts` rather than narrowed, so one config cannot
 * accept a zone spelling the other rejects.
 *
 * `DateTime.zoneMakeNamedUnsafe` throws on an unknown zone and
 * `functional/no-throw-statements` is an ERROR in `src/`, so the throw is
 * converted at the boundary with `Result.try` — the same shape
 * `automations/trigger/cron.ts` uses.
 *
 * Exported because the ACTION HANDLER must repeat this check independently:
 * `context.actions.date.format(...)` reaches the handler through
 * `buildActionsProxy`, which synthesises a raw props object and does NOT decode
 * it against this schema. Boot-time validation therefore covers declared
 * config only, and a code action can still hand the handler anything.
 */
export const isValidTimezone = (timezone: string): boolean =>
  Result.isSuccess(
    Result.try({
      try: () => DateTime.zoneMakeNamedUnsafe(timezone),
      catch: () => undefined,
    })
  )
