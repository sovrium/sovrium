/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { UnsupportedInSqliteError } from '@/infrastructure/database/unsupported-in-sqlite'
import { findCallToken, readArguments } from './formula-call-token'
import { translatePortableFunctions } from './formula-portable-functions'
import { escapeReservedFieldNames } from './formula-utils'

/**
 * SQLite arm of the formula translator.
 *
 * Without a SQLite arm, formula SQL rendered by `translateFormulaToPostgres`
 * would reach SQLite DDL verbatim — a formula whose functions the validator
 * accepts (`domain/validators/formula-keywords.ts` is deliberately
 * dialect-agnostic) is not necessarily valid SQLite.
 *
 * That fails in the worst possible shape. SQLite resolves function names
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
 * `strpos(text, part)` is SQLite's `instr(text, part)`: the same argument
 * order, a 1-based position counted in characters, 0 when absent, blank when
 * either argument is blank, case-sensitive.
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
  strpos: 'instr',
}

/**
 * Whitelisted formula functions that `bun:sqlite` does NOT provide.
 *
 * MEASURED against `bun:sqlite` rather than inferred, because the
 * intuitive guesses are wrong in both directions: Bun ships SQLite's math
 * extension, so `power`, `sqrt`, `ceil`, `floor`, `mod`, `exp`, `ln`, `log`,
 * `sign` and `trunc` all resolve and must NOT be listed here; while `repeat`,
 * which looks primitive, does not exist.
 *
 * `greatest`/`least`/`strpos` are deliberately absent — they are translated
 * above rather than rejected — and so is `chr`, rewritten by {@link chrToSqliteChar}.
 * `ascii` stays listed although SQLite has `unicode`: PostgreSQL's `ascii('')` is
 * 0 where SQLite's `unicode('')` is blank, so it is not a rename.
 *
 * `year`..`second` are absent too: they are rewritten into `date_part_utc`
 * before any SQLite SQL is emitted (`formula-date-parts.ts`).
 *
 * NOT EXHAUSTIVE, on purpose. This is the measured set, and the formula
 * whitelist contains further entries that were never measured (`array_remove`,
 * …). Those still fall through untranslated. Listing them on a hunch would
 * refuse boots on a guess; the honest boundary is "everything we have measured
 * as absent is named here", and the set grows as more are measured.
 */
const SQLITE_UNSUPPORTED_FUNCTIONS: ReadonlySet<string> = new Set([
  // string
  'overlay',
  'repeat',
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
  'date_add',
  'now',
  // array
  'array_length',
  'string_to_array',
  'array_to_string',
  'cardinality',
  'unnest',
  // regex
  'regexp_match',
  'regexp_replace',
  // binary
  'convert_from',
])

/** The portable function to write instead, for a refused function that has one. */
const SQLITE_PORTABLE_HINTS: Readonly<Record<string, string>> = {
  date_add: 'Use add_days(d, n), which moves a date the same way on both engines.',
}

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
  const hints = unsupported.flatMap((name) => {
    const hint = SQLITE_PORTABLE_HINTS[name]
    return hint === undefined ? [] : [` ${hint}`]
  })
  throw new UnsupportedInSqliteError({
    feature: `formula-function:${unsupported.join('+')}`,
    message:
      `Formula "${formula}" calls ${names}, which the SQLite runtime does not provide. ` +
      `SQLite resolves function names at statement time, so emitting this formula would ` +
      `create a view that then rejects every read and write. Rewrite the formula using ` +
      `functions available on both engines, or run this app on PostgreSQL by setting DATABASE_URL.` +
      hints.join(''),
  })
}

/**
 * `CAST(<value> AS DATE)` as SQLite's `date(<value>)`. SQLite has no DATE type:
 * the cast took NUMERIC affinity, so `CAST('2026-09-30T14:00:00.000Z' AS DATE)`
 * read `2026` — the leading number. `date()` reads the day of an ISO date-time,
 * in UTC, which is what PostgreSQL's cast of a UTC-pinned datetime reads.
 * Only a cast whose operand holds no parenthesis is rewritten.
 */
const castAsDateToDateCall = (formula: string): string =>
  formula.replace(/\bCAST\s*\(\s*([^()]+?)\s+AS\s+DATE\s*\)/gi, 'date($1)')

/** Rename a Postgres function token to its SQLite equivalent, arguments intact. */
const applyScalarEquivalents = (formula: string): string =>
  Object.entries(SQLITE_SCALAR_EQUIVALENTS).reduce(
    (acc, [postgresName, sqliteName]) =>
      acc.replace(new RegExp(`\\b${postgresName}\\s*\\(`, 'gi'), `${sqliteName}(`),
    formula
  )

/** A `chr(` call token, not the tail of a longer name or a qualified one. */
const CHR_CALL = /(?<![\w.])chr\s*\(/i

/**
 * `chr(<code>)` as `nullif(char(<code>), char(0))`. SQLite's `char` turns a code
 * point into its character exactly as PostgreSQL's `chr` does, accented and
 * non-Latin ones included, but `char(NULL)` answers a NUL character instead of
 * NULL — so a bare rename would turn a blank code into an invisible character.
 * `nullif` restores the blank. Nested calls are rewritten from the outside in.
 */
const chrToSqliteChar = (sql: string): string => {
  const match = CHR_CALL.exec(sql)
  if (match === null) return sql
  const open = match.index + match[0].length - 1
  const { end } = readArguments(sql, open)
  const argument = chrToSqliteChar(sql.slice(open + 1, end - 1))
  const rest = chrToSqliteChar(sql.slice(end))
  return `${sql.slice(0, match.index)}nullif(char(${argument}), char(0))${rest}`
}

const LPAD_CALL = /^(lpad)\s*\(/i

/**
 * `lpad(text, length[, fill])` as PostgreSQL computes it, in SQLite's own
 * functions — SQLite has no `lpad`. A text at least `length` characters long is
 * cut to its first `length` characters; a shorter one is preceded by `fill`
 * (a space when none is given) repeated up to `length` characters, the repeats
 * built by replacing each `00` of `hex(zeroblob(length))`. Characters, not
 * bytes; an empty fill leaves the text as it is; a negative length gives empty
 * text; a blank argument gives blank. Nested calls are rewritten too.
 */
const lpadToSqlite = (sql: string): string => {
  const call = findCallToken(sql, LPAD_CALL)
  if (call === undefined) return sql
  const [text = 'NULL', length = 'NULL', fill = "' '"] = call.args.map(lpadToSqlite)
  const [s, n, f] = [`(${text})`, `(${length})`, `(${fill})`]
  const padded =
    `CASE WHEN length(${s}) >= ${n} THEN substr(${s}, 1, ${n}) ` +
    `ELSE substr(replace(hex(zeroblob(${n})), '00', ${f}), 1, ${n} - length(${s})) || ${s} END`
  return sql.slice(0, call.start) + padded + lpadToSqlite(sql.slice(call.end))
}

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
  const withPortableDates = translatePortableFunctions(formula, allFields ?? [], 'sqlite')
  return escapeReservedFieldNames(
    castAsDateToDateCall(lpadToSqlite(chrToSqliteChar(applyScalarEquivalents(withPortableDates)))),
    allFields
  )
}
