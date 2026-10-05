/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

const DATE_LIKE_FIELD_TYPES: ReadonlySet<string> = new Set(['date', 'datetime', 'time'])

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whether a formula converts a `date`, `datetime` or `time` FIELD to text —
 * `CAST(due AS TEXT)` (or `VARCHAR`/`CHAR`), or an implicit conversion through
 * `||` concatenation or a `CONCAT` / `CONCAT_WS` / `FORMAT` argument.
 *
 * The decision keys off the referenced field's TYPE: `CAST(quantity AS TEXT)`
 * is immutable and stays a generated column, while the same cast over a date
 * is not. PostgreSQL marks `date_out` / `timestamptz_out` / `time_out` STABLE
 * (they follow `DateStyle` and `TimeZone`), so such an expression can never be
 * a `GENERATED ALWAYS AS` column there and must be computed by the row
 * trigger. (`<field>::TEXT` is already rewritten to `TO_CHAR`, which the
 * volatility check catches.)
 */
export const formulaReadsDateAsText = (
  formula: string,
  allFields: readonly { name: string; type: string }[]
): boolean =>
  allFields
    .filter((field) => DATE_LIKE_FIELD_TYPES.has(field.type))
    .some((field) => {
      const name = `"?${escapeRegExp(field.name)}"?`
      return [
        new RegExp(`CAST\\s*\\(\\s*${name}\\s+AS\\s+(?:TEXT|VARCHAR|CHAR)`, 'i'),
        new RegExp(`(?<![\\w"])${name}\\s*\\|\\|`, 'i'),
        new RegExp(`\\|\\|\\s*${name}(?![\\w"])`, 'i'),
        new RegExp(
          `\\b(?:CONCAT|CONCAT_WS|FORMAT)\\s*\\([^()]*(?<![\\w"'])${name}(?![\\w"'])`,
          'i'
        ),
      ].some((pattern) => pattern.test(formula))
    })

/**
 * Whether a formula converts a `datetime` FIELD in a way PostgreSQL computes
 * through the session's `TimeZone` — `EXTRACT(YEAR FROM starts_at)`,
 * `DATE_PART('hour', starts_at)`, `DATE(starts_at)`, `CAST(starts_at AS DATE)`,
 * `starts_at + INTERVAL '1 day'`.
 *
 * A `datetime` is a `TIMESTAMPTZ`, and every one of those conversions is STABLE
 * there, so PostgreSQL refuses each as a generated column ("generation
 * expression is not immutable" — measured on PostgreSQL 17). The same shapes
 * over a `date` are immutable and stay generated. Only shapes PostgreSQL
 * refuses are listed, so no database already holds one as a generated column
 * and routing it to the trigger changes no deployed schema.
 */
export const formulaConvertsDatetime = (
  formula: string,
  allFields: readonly { name: string; type: string }[]
): boolean =>
  allFields
    .filter((field) => field.type === 'datetime')
    .some((field) => {
      const name = `"?${escapeRegExp(field.name)}"?(?![\\w"])`
      return [
        new RegExp(`EXTRACT\\s*\\(\\s*\\w+\\s+FROM\\s+${name}`, 'i'),
        new RegExp(`DATE_PART\\s*\\([^,()]+,\\s*${name}`, 'i'),
        new RegExp(`(?<![\\w.])DATE\\s*\\(\\s*${name}\\s*\\)`, 'i'),
        new RegExp(
          `CAST\\s*\\(\\s*${name}\\s+AS\\s+(?!TIMESTAMPTZ\\b|TIMESTAMP\\s+WITH\\s+TIME\\s+ZONE\\b)`,
          'i'
        ),
        new RegExp(`(?<![\\w"])${name}\\s*[-+]\\s*INTERVAL\\b`, 'i'),
        new RegExp(`INTERVAL\\s+'[^']*'\\s*\\+\\s*${name}`, 'i'),
      ].some((pattern) => pattern.test(formula))
    })

/**
 * Functions PostgreSQL marks STABLE whatever their arguments: `CONCAT` and
 * `FORMAT` take `any` and format through the session's settings, and `AGE` over
 * any column Sovrium stores reads the current date or a `TIMESTAMPTZ`. Each is
 * refused as a generated column on PostgreSQL, and each is an ordinary
 * immutable function on SQLite — so the check lives on the PostgreSQL arm only.
 */
const POSTGRES_STABLE_FUNCTION = /\b(?:CONCAT|CONCAT_WS|FORMAT|AGE)\s*\(/i

const withoutStringLiterals = (formula: string): string => formula.replace(/'(?:[^']|'')*'/g, "''")

/**
 * Whether PostgreSQL would refuse a formula as a `GENERATED ALWAYS AS` column
 * because it is not immutable there: a date/datetime/time read as text, a
 * `datetime` converted through the time zone, or a call to a STABLE function.
 * Such a formula is computed by the row trigger on PostgreSQL. Every shape
 * listed is one PostgreSQL refuses, so none can already be a generated column
 * in a deployed database, and adding a shape here migrates no schema.
 */
export const formulaIsStableOnPostgres = (
  formula: string,
  allFields: readonly { name: string; type: string }[]
): boolean =>
  POSTGRES_STABLE_FUNCTION.test(withoutStringLiterals(formula)) ||
  formulaNeedsUtcSession(formula, allFields)

/**
 * Whether a trigger-computed formula must run with the session pinned to UTC
 * and ISO dates, so it reads what SQLite computes: a date/datetime/time read
 * as text, or a `datetime` converted through the time zone.
 */
export const formulaNeedsUtcSession = (
  formula: string,
  allFields: readonly { name: string; type: string }[]
): boolean =>
  formulaReadsDateAsText(formula, allFields) || formulaConvertsDatetime(formula, allFields)
