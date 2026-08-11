/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { UnsupportedInSqliteError } from '@/infrastructure/database/unsupported-in-sqlite'
import { escapeReservedFieldNames } from './formula-utils'

/**
 * SQLite arm of the formula translator.
 *
 * Formula SQL used to be rendered by `translateFormulaToPostgres` at every
 * call site, with no SQLite counterpart and no dialect branch — so a formula
 * whose functions the validator accepts (`domain/validators/formula-keywords.ts`
 * is deliberately dialect-agnostic) was emitted verbatim into SQLite DDL.
 *
 * That failed in the worst possible shape. SQLite resolves function names
 * LAZILY, at statement time, so `CREATE VIEW … GREATEST(0, x - y) …` is accepted
 * without complaint and the table looks healthy. Every later operation on the
 * view-backed table then dies with `no such function: GREATEST` — including
 * WRITES, because inserts route through the view's `INSTEAD OF` trigger. The
 * app boots, the schema initializes, and the first INSERT explodes.
 *
 * This module makes both halves explicit:
 *
 *   - functions that HAVE a SQLite equivalent are translated
 *     ({@link SQLITE_SCALAR_EQUIVALENTS});
 *   - functions that do not are rejected LOUDLY, at DDL-generation time, naming
 *     the function and the dialect ({@link SQLITE_UNSUPPORTED_FUNCTIONS}).
 *
 * A refused boot that names `to_char` is strictly better than a view that
 * creates cleanly and then rejects every write.
 */

/**
 * Postgres formula functions that map onto a SQLite built-in.
 *
 * `GREATEST`/`LEAST` map to SQLite's `max`/`min`. Note SQLite overloads those
 * names: with ONE argument they are the AGGREGATE forms, with two or more the
 * SCALAR forms this translation intends. Every real use of `GREATEST`/`LEAST`
 * passes at least two operands (a one-argument `GREATEST(x)` is a no-op in
 * Postgres and has no reason to be written), so the mapping is a rename of the
 * function token only — nesting and argument counts are left untouched.
 */
const SQLITE_SCALAR_EQUIVALENTS: Readonly<Record<string, string>> = {
  greatest: 'max',
  least: 'min',
}

/**
 * Whitelisted formula functions that `bun:sqlite` does NOT provide.
 *
 * MEASURED against `bun:sqlite` (2026-07-26) rather than inferred, because the
 * intuitive guesses are wrong in both directions: Bun ships SQLite's math
 * extension, so `power`, `sqrt`, `ceil`, `floor`, `mod`, `exp`, `ln`, `log`,
 * `sign` and `trunc` all resolve and must NOT be listed here; while `repeat`
 * and `strpos`, which look primitive, do not exist.
 *
 * `greatest`/`least` are deliberately absent — they are translated above rather
 * than rejected.
 *
 * NOT EXHAUSTIVE, on purpose. This is the measured set, and the formula
 * whitelist contains further entries that were never measured (`string_to_array`,
 * `array_to_string`, `date_add`, `date_sub`, `minute`, `second`, `array_remove`,
 * `flatten`, …). Those still fall through untranslated. Listing them on a hunch
 * would refuse boots on a guess; the honest boundary is "everything we have
 * measured as absent is named here", and the set grows as more are measured.
 */
const SQLITE_UNSUPPORTED_FUNCTIONS: ReadonlySet<string> = new Set([
  // string
  'overlay',
  'repeat',
  'strpos',
  'chr',
  'ascii',
  'encode',
  'decode',
  'initcap',
  // date / time
  'extract',
  'date_trunc',
  'to_char',
  'to_date',
  'to_timestamp',
  'age',
  'year',
  'month',
  'day',
  'hour',
  'date_diff',
  'now',
  // array
  'array_length',
  'cardinality',
  'unnest',
  // regex
  'regexp_match',
  'regexp_replace',
  // binary
  'convert_from',
])

/** Every `name(` token in a formula, lower-cased. */
const FUNCTION_CALL_PATTERN = /\b([a-z_][a-z0-9_]*)\s*\(/gi

/**
 * Names of the functions `formula` invokes that SQLite cannot resolve.
 *
 * Matches on a call token (`name` immediately followed by `(`) so a FIELD that
 * happens to share a function's name — a column called `day`, say — is never
 * mistaken for a call.
 */
const findUnsupportedFunctions = (formula: string): readonly string[] => {
  const called = [...formula.matchAll(FUNCTION_CALL_PATTERN)].map((match) =>
    (match[1] ?? '').toLowerCase()
  )
  return [...new Set(called.filter((name) => SQLITE_UNSUPPORTED_FUNCTIONS.has(name)))]
}

/**
 * Reject a formula that calls a function the SQLite runtime cannot resolve.
 *
 * Raised while the DDL is being GENERATED, so the failure lands at schema
 * initialization with the offending function named — instead of at the first
 * write against a view that was created successfully.
 *
 * @throws {UnsupportedInSqliteError} when any measured-unsupported function is called
 */
const rejectUnsupportedSqliteFunctions = (formula: string): void => {
  const unsupported = findUnsupportedFunctions(formula)
  if (unsupported.length === 0) return
  const names = unsupported.join(', ')
  // eslint-disable-next-line functional/no-throw-statements -- explicit degradation boundary: emitting this formula would produce DDL that only fails at write time
  throw new UnsupportedInSqliteError({
    feature: `formula-function:${unsupported.join('+')}`,
    message:
      `Formula "${formula}" calls ${names}, which the SQLite runtime does not provide. ` +
      `SQLite resolves function names at statement time, so emitting this formula would ` +
      `create a view that then rejects every read and write. Rewrite the formula using ` +
      `functions available on both engines, or run this app on PostgreSQL by setting DATABASE_URL.`,
  })
}

/** Rename a Postgres function token to its SQLite equivalent, arguments intact. */
const applyScalarEquivalents = (formula: string): string =>
  Object.entries(SQLITE_SCALAR_EQUIVALENTS).reduce(
    (acc, [postgresName, sqliteName]) =>
      acc.replace(new RegExp(`\\b${postgresName}\\s*\\(`, 'gi'), `${sqliteName}(`),
    formula
  )

/**
 * Translate a formula from the user-facing (Postgres-flavoured) syntax into
 * SQLite syntax.
 *
 * Three of the Postgres translator's passes are deliberately NOT run here,
 * because each emits syntax SQLite rejects:
 *
 *   - `date_field::TEXT` → `TO_CHAR(…)`: SQLite has no `to_char`.
 *   - `SUBSTR(…)` → `SUBSTRING(… FROM … FOR …)`: SQLite has a native `substr`
 *     and no `SUBSTRING … FROM … FOR` form, so the user's own spelling is the
 *     correct one to keep.
 *   - `ROUND(SQRT(x), 2)` → `ROUND((SQRT(x))::NUMERIC, 2)`: `::` is Postgres
 *     cast syntax, and SQLite's `round` already accepts a REAL.
 *
 * Reserved-word escaping IS shared — SQLite quotes identifiers with double
 * quotes exactly as Postgres does.
 *
 * @throws {UnsupportedInSqliteError} when the formula calls a function SQLite lacks
 */
export const translateFormulaToSqlite = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  // Checked against the formula AS WRITTEN so the error names the function the
  // author typed, not one an intermediate pass introduced.
  rejectUnsupportedSqliteFunctions(formula)
  return escapeReservedFieldNames(applyScalarEquivalents(formula), allFields)
}
