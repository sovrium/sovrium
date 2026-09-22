/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `date/*` action handlers — timezone- and locale-aware date operations.
 *
 * Eight operators, each a thin wrapper over `domain/services/date-tokens.ts`
 * (formatting/parsing) and `Effect.DateTime` (zoned calendar arithmetic):
 *
 *  - `format`    → `{ formatted }`
 *  - `parse`     → `{ instant: string | null, valid: boolean }`
 *  - `add`       → `{ instant }`
 *  - `subtract`  → `{ instant }`
 *  - `diff`      → `{ value }`
 *  - `startOf`   → `{ instant }`
 *  - `endOf`     → `{ instant }`
 *  - `now`       → `{ instant }` (+ `{ formatted }` when `pattern` is given)
 *
 * All eight are deterministic, side-effect-free transforms except `now`, which
 * is the type's ONLY clock read — that isolation is what keeps the other seven
 * reproducible from a run's recorded inputs. No repository, port or I/O is
 * involved, so the work is wrapped in `Effect.sync` rather than
 * `Effect.tryPromise`.
 *
 * Template references in `props` are resolved by the run loop's substitution
 * pass before a handler sees them, so every prop here is already concrete.
 *
 * Prop validation is repeated rather than delegated to the schemas — see the
 * header of `date-support.ts` for why the code-action path makes that
 * mandatory rather than defensive.
 */

import { DateTime, Effect } from 'effect'
import { formatWithTokens, parseWithTokens } from '@/domain/kernel/format/date-tokens'
import {
  CALENDAR_DIFF_UNITS,
  diffInUnits,
  FIXED_DIFF_UNIT_MS,
  isoOf,
  isPatternAuthorError,
  optionalString,
  propsOf,
  resolveDuration,
  resolveInstant,
  resolveTimezone,
  shiftInstant,
  zonedAt,
} from './date-support'
import type { ActionHandler, ActionOutcome } from './shared'

const failure = (error: string): ActionOutcome => ({ status: 'failure', error })

const success = (output: Readonly<Record<string, unknown>>): ActionOutcome => ({
  status: 'success',
  output,
})

/** Units `startOf`/`endOf` accept, mirroring `CalendarUnitProp`. */
const BOUNDARY_UNITS: ReadonlySet<DateTime.DateTime.UnitSingular> = new Set([
  'year',
  'month',
  'week',
  'day',
  'hour',
  'minute',
  'second',
])

/**
 * ISO 8601 weeks start on Monday. Fixed rather than configurable — a
 * `weekStartsOn` prop would be a second place to encode a locale convention,
 * and `Effect.DateTime` defaults to Sunday, so this must be passed explicitly
 * at every boundary call or `startOf: week` silently answers a day early.
 */
const WEEK_STARTS_ON = 1 as const

/**
 * `date/format` — render an instant through a pattern, in a zone and locale.
 *
 * A bad instant fails the step: the output is a single `formatted` string with
 * nowhere to report a verdict. `date:parse` is the operator with a validity
 * channel.
 */
export const handleDateFormat: ActionHandler = (action, _app, _automation) =>
  Effect.sync(() => {
    const props = propsOf(action)
    const timezone = resolveTimezone(props, 'format')
    if (!timezone.ok) return failure(timezone.error)
    const pattern = optionalString(props, 'pattern')
    if (pattern === undefined) return failure('date.format requires a `pattern`')
    const instant = resolveInstant(props, 'input', 'format')
    if (!instant.ok) return failure(instant.error)

    const rendered = formatWithTokens(instant.value, pattern, {
      timezone: timezone.value,
      locale: optionalString(props, 'locale'),
    })
    return rendered.ok
      ? success({ formatted: rendered.value })
      : failure(`date.format: ${rendered.error.message}`)
  }).pipe(Effect.withSpan('automations.handle-date-format'))

/**
 * `date/parse` — read a string back into an instant.
 *
 * Validity is DATA. A string that does not match the pattern succeeds with
 * `{ instant: null, valid: false }` because it is a fact about the input, not a
 * misconfiguration: failing the step would burn the retry budget on a verdict
 * that cannot change, and would stop the branch before a downstream
 * `filter`/`path` could route the invalid row.
 *
 * A malformed PATTERN is the opposite case — an author error — and does fail.
 */
export const handleDateParse: ActionHandler = (action, _app, _automation) =>
  Effect.sync(() => {
    const props = propsOf(action)
    const timezone = resolveTimezone(props, 'parse')
    if (!timezone.ok) return failure(timezone.error)
    const pattern = optionalString(props, 'pattern')
    if (pattern === undefined) return failure('date.parse requires a `pattern`')
    const raw = props['input']
    const input = typeof raw === 'string' ? raw : String(raw ?? '')

    const read = parseWithTokens(input, pattern, { timezone: timezone.value })
    if (read.ok) return success({ instant: read.value.toISOString(), valid: true })
    if (isPatternAuthorError(read.error.code)) return failure(`date.parse: ${read.error.message}`)
    // The public output contract is `{ instant: string | null, valid: boolean }`.
    // `undefined` would drop the key from the JSON body entirely, so a consumer
    // could not tell "no instant" from "this operator does not report one".
    // eslint-disable-next-line unicorn/no-null -- explicit null is the wire contract
    return success({ instant: null, valid: false })
  }).pipe(Effect.withSpan('automations.handle-date-parse'))

/**
 * Shared body of `add` and `subtract` — the same zoned calendar shift with the
 * sign flipped. `subtract` exists as its own operator because a leading `-` in
 * YAML is easy to lose in review and the failure is silent.
 */
const shiftHandler =
  (operator: 'add' | 'subtract', sign: 1 | -1): ActionHandler =>
  (action, _app, _automation) =>
    Effect.sync(() => {
      const props = propsOf(action)
      const timezone = resolveTimezone(props, operator)
      if (!timezone.ok) return failure(timezone.error)
      const instant = resolveInstant(props, 'input', operator)
      if (!instant.ok) return failure(instant.error)
      const duration = resolveDuration(props, operator)
      if (!duration.ok) return failure(duration.error)
      const zoned = zonedAt(instant.value, timezone.value, operator)
      if (!zoned.ok) return failure(zoned.error)

      return success({
        instant: isoOf(shiftInstant({ zoned: zoned.value, duration: duration.value, sign })),
      })
    })

/** `date/add` — shift an instant forward, DST-correct in the given zone. */
export const handleDateAdd: ActionHandler = shiftHandler('add', 1)

/** `date/subtract` — shift an instant backward, DST-correct in the given zone. */
export const handleDateSubtract: ActionHandler = shiftHandler('subtract', -1)

/**
 * `date/diff` — signed, zero-truncated distance between two instants.
 *
 * Signed `to` minus `from`: an automation deciding "is this overdue" needs the
 * sign, and magnitude is recoverable downstream where a lost sign is not.
 */
export const handleDateDiff: ActionHandler = (action, _app, _automation) =>
  Effect.sync(() => {
    const props = propsOf(action)
    const timezone = resolveTimezone(props, 'diff')
    if (!timezone.ok) return failure(timezone.error)
    const unit = optionalString(props, 'unit')
    if (
      unit === undefined ||
      (FIXED_DIFF_UNIT_MS[unit] === undefined && CALENDAR_DIFF_UNITS[unit] === undefined)
    ) {
      return failure(
        'date.diff requires a `unit` of year, month, week, day, hour, minute, second or millisecond'
      )
    }
    const from = resolveInstant(props, 'from', 'diff')
    if (!from.ok) return failure(from.error)
    const to = resolveInstant(props, 'to', 'diff')
    if (!to.ok) return failure(to.error)
    const fromZoned = zonedAt(from.value, timezone.value, 'diff')
    if (!fromZoned.ok) return failure(fromZoned.error)
    const toZoned = zonedAt(to.value, timezone.value, 'diff')
    if (!toZoned.ok) return failure(toZoned.error)

    return success({
      value: diffInUnits({
        from: from.value,
        to: to.value,
        fromZoned: fromZoned.value,
        toZoned: toZoned.value,
        unit,
      }),
    })
  }).pipe(Effect.withSpan('automations.handle-date-diff'))

/**
 * Shared body of `startOf` and `endOf`. `endOf` is INCLUSIVE and lands on
 * `.999` ms, so `[startOf, endOf]` is a closed range an author can hand
 * straight to a record filter with `lte`.
 */
const boundaryHandler =
  (operator: 'startOf' | 'endOf'): ActionHandler =>
  (action, _app, _automation) =>
    Effect.sync(() => {
      const props = propsOf(action)
      const timezone = resolveTimezone(props, operator)
      if (!timezone.ok) return failure(timezone.error)
      const unit = optionalString(props, 'unit') as DateTime.DateTime.UnitSingular | undefined
      if (unit === undefined || !BOUNDARY_UNITS.has(unit)) {
        return failure(
          `date.${operator} requires a \`unit\` of year, month, week, day, hour, minute or second`
        )
      }
      const instant = resolveInstant(props, 'input', operator)
      if (!instant.ok) return failure(instant.error)
      const zoned = zonedAt(instant.value, timezone.value, operator)
      if (!zoned.ok) return failure(zoned.error)

      const snapped =
        operator === 'startOf'
          ? DateTime.startOf(zoned.value, unit, { weekStartsOn: WEEK_STARTS_ON })
          : DateTime.endOf(zoned.value, unit, { weekStartsOn: WEEK_STARTS_ON })
      return success({ instant: isoOf(DateTime.toEpochMillis(snapped)) })
    })

/** `date/startOf` — snap back to the start of the enclosing calendar unit. */
export const handleDateStartOf: ActionHandler = boundaryHandler('startOf')

/** `date/endOf` — snap forward to the inclusive end of the enclosing unit. */
export const handleDateEndOf: ActionHandler = boundaryHandler('endOf')

/**
 * `date/now` — capture the current instant.
 *
 * The only non-deterministic operator in the type. `instant` is always UTC;
 * `timezone`/`locale` affect `formatted` only, which exists so "stamp this run
 * with the local time" is one step rather than `now` + `format`.
 */
export const handleDateNow: ActionHandler = (action, _app, _automation) =>
  Effect.sync(() => {
    const props = propsOf(action)
    const timezone = resolveTimezone(props, 'now')
    if (!timezone.ok) return failure(timezone.error)
    const instant = new Date()
    const pattern = optionalString(props, 'pattern')
    if (pattern === undefined) return success({ instant: instant.toISOString() })

    const rendered = formatWithTokens(instant, pattern, {
      timezone: timezone.value,
      locale: optionalString(props, 'locale'),
    })
    return rendered.ok
      ? success({ instant: instant.toISOString(), formatted: rendered.value })
      : failure(`date.now: ${rendered.error.message}`)
  }).pipe(Effect.withSpan('automations.handle-date-now'))
