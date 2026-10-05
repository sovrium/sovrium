/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The development clock (`SOVRIUM_DEV_CLOCK`) as a formula computed on write
 * reads it.
 *
 * A formula over `CURRENT_DATE` is computed by a trigger, inside the database,
 * where the server's pinned instant cannot reach it at run time. So when the
 * clock is pinned, the trigger is WRITTEN with the pinned day and instant in
 * place of the engine's own clock functions, and carries a marker comment the
 * migration fast path looks for: a later boot without the clock finds the
 * marker and rebuilds the triggers on the real clock (`schema-initializer-
 * execute.ts`), so a pinned day never outlives the setting that pinned it.
 */

import { readSovriumDevClock } from '@/domain/models/process-env/dev-clock'

/** The comment a trigger written against a pinned clock carries. */
export const DEV_CLOCK_MARKER = 'sovrium-dev-clock'

type Dialect = 'postgres' | 'sqlite'

/** What a clock read returns: a day, an instant, a local date-time, or a time of day. */
type ClockKind = 'date' | 'timestamp' | 'localTimestamp' | 'time' | 'localTime'

/** The literal each kind of clock read is written as, per engine. */
const clockLiterals = (
  now: Readonly<Date>,
  dialect: Dialect
): Readonly<Record<ClockKind, string>> => {
  const iso = now.toISOString()
  const day = iso.slice(0, 10)
  const localDateTime = iso.slice(0, 23).replace('T', ' ')
  const timeOfDay = iso.slice(11, 23)
  return dialect === 'postgres'
    ? {
        date: `DATE '${day}'`,
        timestamp: `TIMESTAMPTZ '${iso}'`,
        localTimestamp: `TIMESTAMP '${localDateTime}'`,
        time: `TIMETZ '${timeOfDay}+00'`,
        localTime: `TIME '${timeOfDay}'`,
      }
    : // SQLite's own clock keywords return UTC text: `YYYY-MM-DD HH:MM:SS`,
      // `YYYY-MM-DD`, `HH:MM:SS`.
      {
        date: `'${day}'`,
        timestamp: `'${iso.slice(0, 19).replace('T', ' ')}'`,
        localTimestamp: `'${iso.slice(0, 19).replace('T', ' ')}'`,
        time: `'${iso.slice(11, 19)}'`,
        localTime: `'${iso.slice(11, 19)}'`,
      }
}

/**
 * Every clock read a formula can spell, outside a string literal, with the
 * optional precision argument the SQL-standard keywords take
 * (`CURRENT_TIMESTAMP(0)`), so the argument is replaced with the call rather
 * than left dangling after a literal.
 */
const CLOCK_CALL =
  /\b(CURRENT_DATE|CURRENT_TIMESTAMP|CURRENT_TIME|LOCALTIMESTAMP|LOCALTIME)\b(?:\s*\(\s*\d*\s*\))?|\b(NOW|TRANSACTION_TIMESTAMP|STATEMENT_TIMESTAMP|CLOCK_TIMESTAMP)\s*\(\s*\)/gi

/** Which kind of value the clock read named `name` returns. */
const kindOf = (name: string): ClockKind => {
  switch (name.toUpperCase()) {
    case 'CURRENT_DATE':
      return 'date'
    case 'LOCALTIMESTAMP':
      return 'localTimestamp'
    case 'CURRENT_TIME':
      return 'time'
    case 'LOCALTIME':
      return 'localTime'
    default:
      return 'timestamp'
  }
}

/**
 * `sql` with its clock reads replaced by the pinned instant, marked; `sql`
 * unchanged when no clock is pinned or it reads none.
 *
 * Only the text OUTSIDE single-quoted literals is rewritten, so a label that
 * happens to spell `CURRENT_DATE` keeps it.
 */
export const pinFormulaClock = (
  sql: string,
  dialect: Dialect,
  now: Readonly<Date> | undefined = readSovriumDevClock()
): string => {
  if (now === undefined) return sql
  const literals = clockLiterals(now, dialect)
  // Odd segments of a split on `'` are inside a string literal (`''` escapes
  // produce an empty segment, which keeps the parity right).
  const segments = sql.split("'")
  const rewritten = segments
    .map((segment, index) =>
      index % 2 === 1
        ? segment
        : segment.replace(
            CLOCK_CALL,
            (_call, keyword: string | undefined, fn: string | undefined) =>
              literals[kindOf(keyword ?? fn ?? '')]
          )
    )
    .join("'")
  return rewritten === sql ? sql : `${rewritten} /* ${DEV_CLOCK_MARKER} */`
}
