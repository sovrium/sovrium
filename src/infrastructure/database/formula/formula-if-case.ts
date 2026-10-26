/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { findCallToken } from './formula-call-token'

/**
 * The spreadsheet conditional `IF(condition, then[, else])`, rewritten into
 * `CASE` so both engines compute it the same way.
 *
 * PostgreSQL has no `IF` function, and SQLite's `if` exists only from 3.48.
 * The arity follows SQLite's `if`, so one formula reads one meaning:
 *
 * - `IF(c, a)` → `CASE WHEN c THEN a END` (blank when `c` is not met)
 * - `IF(c, a, b)` → `CASE WHEN c THEN a ELSE b END`
 * - `IF(c1, a1, c2, a2, …[, e])` → one `WHEN` per pair, a trailing odd
 *   argument as the `ELSE`
 *
 * A blank condition takes the other branch, which is what `CASE` does.
 */

/** An `IF` call with fewer than two arguments, or an empty one. */
export class FormulaIfArityError extends Data.TaggedError('FormulaIfArityError')<{
  readonly call: string
  readonly message: string
}> {}

const IF_CALL = /^(if)\s*\(/i

/** `CASE` from already-rewritten arguments: one `WHEN` per pair, an odd tail as `ELSE`. */
const renderCase = (args: readonly string[]): string => {
  const pairCount = Math.floor(args.length / 2)
  const whens = Array.from(
    { length: pairCount },
    (_, index) => `WHEN ${args[index * 2] ?? ''} THEN ${args[index * 2 + 1] ?? ''}`
  )
  const otherwise = args.length % 2 === 1 ? ` ELSE ${args[args.length - 1] ?? ''}` : ''
  return `CASE ${whens.join(' ')}${otherwise} END`
}

/**
 * Rewrite every `IF(` call of a formula into `CASE`, nested calls included,
 * from the outside in. Anything else is left exactly as written.
 *
 * @throws {FormulaIfArityError} when an `IF` has fewer than two arguments
 */
export const rewriteIfToCase = (sql: string): string => {
  const call = findCallToken(sql, IF_CALL)
  if (call === undefined) return sql
  if (call.args.length < 2 || call.args.some((arg) => arg === '')) {
    const written = sql.slice(call.start, call.end)
    // The translator refuses an invalid formula at DDL generation, so the boot names the call
    throw new FormulaIfArityError({
      call: written,
      message:
        `IF needs a condition and a value: ${written} does not have them. ` +
        `Write IF(condition, then) or IF(condition, then, else).`,
    })
  }
  const args = call.args.map(rewriteIfToCase)
  return sql.slice(0, call.start) + renderCase(args) + rewriteIfToCase(sql.slice(call.end))
}
