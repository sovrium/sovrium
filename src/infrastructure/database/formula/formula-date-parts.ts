/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { findCallToken } from './formula-call-token'

/**
 * The spreadsheet date parts `YEAR(x)`, `MONTH(x)`, `DAY(x)`, `HOUR(x)`,
 * `MINUTE(x)` and `SECOND(x)`, rewritten into `date_part_utc('<part>', x)`.
 *
 * Neither engine has these functions. `date_part_utc` reads each part the same
 * way on SQLite and PostgreSQL, in UTC, so the rewrite runs before the
 * portable-date pass and before anything reads which portable calls a formula
 * makes: each part inherits `date_part_utc`'s answer and its routing.
 */

/** A date-part call with other than exactly one argument. */
export class FormulaDatePartArityError extends Data.TaggedError('FormulaDatePartArityError')<{
  readonly call: string
  readonly message: string
}> {}

const DATE_PART_CALL = /^(year|month|day|hour|minute|second)\s*\(/i

/**
 * Rewrite every date-part call of a formula into `date_part_utc`, nested calls
 * included. A field named `day` is not a call and stays as written.
 *
 * @throws {FormulaDatePartArityError} when a date part does not take exactly one argument
 */
export const rewriteDatePartsToPortable = (sql: string): string => {
  const call = findCallToken(sql, DATE_PART_CALL)
  if (call === undefined) return sql
  const [date] = call.args
  if (call.args.length !== 1 || date === undefined || date === '') {
    const written = sql.slice(call.start, call.end)
    const name = call.name.toUpperCase()
    // The translator refuses an invalid formula at DDL generation, so the boot names the call
    throw new FormulaDatePartArityError({
      call: written,
      message: `${name} reads one date: ${written} does not. Write ${name}(date).`,
    })
  }
  return (
    sql.slice(0, call.start) +
    `date_part_utc('${call.name}', ${rewriteDatePartsToPortable(date)})` +
    rewriteDatePartsToPortable(sql.slice(call.end))
  )
}
