/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_DEV_CLOCK` — the instant a DEVELOPMENT server answers "today" at.
 *
 * An app seeded on one day and read a week later answers every relative
 * question with the real date: an Overdue list grows, a schedule formula over
 * `CURRENT_DATE` flips. A browser clock can be pinned for a review; the
 * server's cannot. Setting this variable to an ISO 8601 instant makes the
 * server answer every "today" and "now" at that instant — the `$today` family
 * of relative-date filters, formulas computed on write over `CURRENT_DATE` /
 * `NOW()`, and the automation `{{today}}` / `{{now}}` helpers.
 *
 * ─── WHY PRODUCTION REFUSES IT ─────────────────────────────────────────────
 *
 * A pinned clock on a deployed instance would stamp every write with a date
 * that is not true. So a server started with `NODE_ENV=production` refuses to
 * boot while it is set, naming the variable.
 *
 * ─── WHY A MALFORMED VALUE THROWS ──────────────────────────────────────────
 *
 * A value read leniently would fall back to the real clock with no diagnostic,
 * which is exactly the state the variable exists to leave. Only an ISO 8601
 * date (`2026-09-24`, UTC midnight) or date-time (`2026-09-24T10:00:00+02:00`)
 * is accepted; a date-time without an offset reads as UTC.
 *
 * Pure: the environment is a parameter. Uncached on purpose, for the reason
 * `SOVRIUM_TIMEZONE` gives: an in-process test harness boots many servers per
 * worker.
 */

import { DateTime, Option } from 'effect'

/** The variable's name, so a caller can quote it without spelling it again. */
export const SOVRIUM_DEV_CLOCK_VAR = 'SOVRIUM_DEV_CLOCK'

/** A calendar date, or a date-time with an optional seconds fraction and offset. */
const ISO_8601_INSTANT =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

type Env = Readonly<Record<string, string | undefined>>

/** The trimmed value, or `''` when unset or whitespace-only. */
const rawValue = (env: Env): string => env[SOVRIUM_DEV_CLOCK_VAR]?.trim() ?? ''

/** A date-time with no offset reads as UTC rather than as the host's zone. */
const withOffset = (raw: string): string =>
  raw.includes('T') && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw) ? `${raw}Z` : raw

/**
 * Whether the calendar day `raw` starts with exists. The date parser rolls an
 * impossible day over (`2026-02-30` reads as 2 March), which would pin a day
 * nobody wrote.
 */
const isRealCalendarDay = (raw: string): boolean => {
  const [year, month, day] = raw.slice(0, 10).split('-').map(Number) as [number, number, number]
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

/** The instant `raw` names, or `undefined` when it is not an ISO 8601 instant. */
const instantOf = (raw: string): Readonly<Date> | undefined => {
  if (!ISO_8601_INSTANT.test(raw) || !isRealCalendarDay(raw)) return undefined
  const parsed = DateTime.make(withOffset(raw))
  return Option.isSome(parsed) ? DateTime.toDateUtc(parsed.value) : undefined
}

/**
 * Resolve `SOVRIUM_DEV_CLOCK` at boot.
 *
 * Unset, empty or whitespace-only resolves to `undefined` (the real clock).
 *
 * @param env - the environment to read (defaults to the process environment).
 * @throws Error naming the variable when `NODE_ENV` is `production`, or naming
 *   the variable, the value and the expected shape when it is not ISO 8601.
 */
export const parseSovriumDevClock = (env: Env = process.env): Readonly<Date> | undefined => {
  const raw = rawValue(env)
  if (raw === '') return undefined
  if (env['NODE_ENV'] === 'production') {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_DEV_CLOCK_VAR} is a development setting and is refused when NODE_ENV=production; unset it to start this server.`
    )
  }
  const instant = instantOf(raw)
  if (instant === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
    throw new Error(
      `${SOVRIUM_DEV_CLOCK_VAR} must be an ISO 8601 instant such as "2026-09-24T10:00:00+02:00" or "2026-09-24"; got "${raw}".`
    )
  }
  return instant
}

/**
 * The pinned instant, or `undefined` when none is set. Never throws: the boot
 * already refused a malformed or production value, so a request-time reader
 * treats one it cannot read as unset.
 *
 * @param env - the environment to read (defaults to the process environment).
 */
export const readSovriumDevClock = (env: Env = process.env): Readonly<Date> | undefined => {
  const raw = rawValue(env)
  return raw === '' || env['NODE_ENV'] === 'production' ? undefined : instantOf(raw)
}

/**
 * "Now" as the server answers it: the pinned instant when `SOVRIUM_DEV_CLOCK`
 * is set, the real clock otherwise.
 *
 * @param env - the environment to read (defaults to the process environment).
 */
export const serverNow = (env: Env = process.env): Readonly<Date> =>
  readSovriumDevClock(env) ?? new Date()
