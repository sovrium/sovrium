/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { likePatternOf } from '@/domain/kernel/sql/like-pattern'
import { LIKE_ESCAPE_CHARACTER } from '@/domain/kernel/sql/sql-formatting'
import { betweenFragment } from './between-condition'
import { notContainsFragment } from './not-contains-condition'
import { serverOperatorFragment } from './server-operator-fragment'
import { translatedTextFragment, type Condition } from './translated-text-fragment'
import { unknownOperator } from './unknown-operator'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/** A column a condition reads: a `sql.identifier()` chunk, or an expression over one. */
type SqlIdentifier = Readonly<ReturnType<typeof sql.identifier>> | Readonly<SQL>

/** Maps domain filter operators to SQL comparison operators. */
export const SQL_OPERATOR_MAP: Readonly<Record<string, string>> = {
  equals: '=',
  notEquals: '!=',
  greaterThan: '>',
  lessThan: '<',
  greaterThanOrEqual: '>=',
  lessThanOrEqual: '<=',
  eq: '=',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
}

/**
 * The members a set-membership operator (`in`, `notIn`) compares against.
 *
 * A single value is a list of one: without this, a scalar would fall through to
 * the comparison fallback, `=`, which for `notIn` INVERTS the filter (`notIn:
 * "done"` would list exactly the done rows). A missing member (`null`) is
 * dropped from a `notIn` list: `NOT IN (…, NULL)` is never true, so one null in
 * the list would leave out every row. A row with no value is already left out by
 * the `IS NOT NULL` both builders state.
 */
export const setMembersOf = (operator: 'in' | 'notIn', value: unknown): readonly unknown[] => {
  const members = Array.isArray(value) ? value : [value]
  return operator === 'notIn'
    ? members.filter((member) => member !== null && member !== undefined)
    : members
}

/** Whether an operator is one of the two set-membership operators. */
export const isSetOperator = (operator: string): operator is 'in' | 'notIn' =>
  operator === 'in' || operator === 'notIn'

// ---------------------------------------------------------------------------
// Parameterized fragment builder (RUNTIME query path only)
//
// The DDL generators (view-generators, lookup-* generators) compile filters to
// SQL TEXT with `generateSqlCondition` (`filter-ddl-text.ts`), because bound
// parameters are illegal there.
//
// The function below builds a Drizzle `SQL` fragment with bound parameters
// instead. It is for the RUNTIME record-filter SELECT path only, where
// user-supplied API filter values must become bound query parameters rather
// than inlined-and-escaped string literals (defense-in-depth).
//
// Column names cannot be parameterized in SQL, so they are still validated by
// `validateColumnName` (by the caller) and rendered via `sql.identifier()`.
// All VALUES go through `sql\`${value}\`` placeholder binding.
// ---------------------------------------------------------------------------

// The LIKE escape character and the escaping routine are IMPORTED, never
// restated: a second copy of a rule deciding which rows match drifts apart.

// ---------------------------------------------------------------------------
// DECISION — `contains` / `startsWith` / `endsWith` match text WITHOUT regard
// to case, on every engine.
//
// This is a decision, not an inherited default. A bare `LIKE` is case-SENSITIVE
// on PostgreSQL and case-INSENSITIVE on SQLite (for ASCII), so the identical
// filter answered differently depending on which engine an install happened to
// be running: a search for `zinc` found "Zinc anode 50g" on the zero-config
// SQLite default and found nothing on the Postgres deployment the same config
// gets from every template's Deploy button. Divergence, not a feature.
//
// Case-INSENSITIVE is the arm chosen because it is what an operator typing into
// a search box means, it is Airtable's `contains` semantics, and it is already
// what every OTHER text-search surface here does — the trash search
// (`query-helpers/trash-helpers.ts`), the command palette
// (`repositories/command-search-repository-live.ts`) and the user directory
// (`presentation/api/routes/user-directory.ts`) all reach for the same
// `lower(col) LIKE lower(pattern)` idiom. This is the record-filter path joining
// them, not a fourth spelling.
//
// Honest costs, both accepted:
//   - PostgreSQL cannot use a plain B-tree index for a `lower()`-wrapped
//     predicate. `contains` is `%…%` and was never index-eligible anyway; only
//     `startsWith` gives that up, and only where a `text_pattern_ops` index
//     exists — Sovrium creates none.
//   - `lower()` is locale-aware on PostgreSQL but ASCII-only on SQLite, so
//     non-ASCII case folding (e.g. `İ`) can still differ. That residue is far
//     smaller than the whole-alphabet divergence it replaces.
// ---------------------------------------------------------------------------

/**
 * Build a parameterized LIKE pattern fragment (contains/startsWith/endsWith).
 * The wildcard pattern is bound as a single query parameter; only the wildcards
 * this operator itself contributes are left active.
 *
 * Both sides are case-folded (see the DECISION note above). `lower()` leaves the
 * `\` escape prefixes this function injects untouched, so escaping and folding
 * compose: `Sale 50\% off` folds to `sale 50\% off` with the escape intact.
 */
const buildPatternFragment = (
  column: SqlIdentifier,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  if (operator !== 'contains' && operator !== 'startsWith' && operator !== 'endsWith') {
    return notContainsFragment(column, operator, value)
  }
  const pattern = likePatternOf(operator, typeof value === 'string' ? value : String(value))
  // sql-literal: keyword -- the escape character is a module constant
  return sql`lower(CAST(${column} AS TEXT)) LIKE lower(${pattern}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`
}

/**
 * Build a parameterized NULL/empty check fragment (isNull/isNotNull/isEmpty/isNotEmpty).
 * These reference only the column; no value binding needed.
 */
const buildNullFragment = (column: SqlIdentifier, operator: string): Readonly<SQL> | undefined => {
  if (operator === 'isNull') {
    return sql`${column} IS NULL`
  }
  if (operator === 'isNotNull') {
    return sql`${column} IS NOT NULL`
  }
  if (operator === 'isEmpty') return emptyValueCondition(column)
  if (operator === 'isNotEmpty') return nonEmptyValueCondition(column)
  return undefined
}

/**
 * The text an empty value reads as once cast to text, on either engine: empty
 * text, an empty JSON list or object (`jsonb` on PostgreSQL, JSON text on
 * SQLite), and an empty PostgreSQL array (`TEXT[]` — a multi-select).
 */
const EMPTY_VALUE_TEXTS = sql`('', '[]', '{}')`

/**
 * "This column holds no value": NULL, empty text, an empty list or
 * an empty object.
 * Compared as TEXT, so the one rule reads a number, a date, a JSON list or an
 * array column on both engines — where a bare `= ''` refuses a non-text
 * column on PostgreSQL. No value is bound: the column is the only input.
 */
export const emptyValueCondition = (column: Readonly<SQL> | SqlIdentifier): Readonly<SQL> =>
  sql`(${column} IS NULL OR CAST(${column} AS TEXT) IN ${EMPTY_VALUE_TEXTS})`

/** The negation of {@link emptyValueCondition}: the column holds a value. */
export const nonEmptyValueCondition = (column: Readonly<SQL> | SqlIdentifier): Readonly<SQL> =>
  sql`(${column} IS NOT NULL AND CAST(${column} AS TEXT) NOT IN ${EMPTY_VALUE_TEXTS})`

/**
 * Build a parameterized boolean check fragment (isTrue/isFalse).
 * The boolean literal is a static keyword, not user-supplied data.
 */
const buildBooleanFragment = (
  column: SqlIdentifier,
  operator: string
): Readonly<SQL> | undefined => {
  if (operator === 'isTrue') {
    return sql`${column} = true`
  }
  if (operator === 'isFalse') {
    return sql`${column} = false`
  }
  return undefined
}

/**
 * Build a parameterized `in` / `notIn` fragment. Each member is bound
 * individually; a row with no value is kept by neither (see
 * `generateSqlCondition`'s `in` handler, and {@link setMembersOf} for a single value).
 */
const buildInFragment = (
  column: SqlIdentifier,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  if (!isSetOperator(operator)) return undefined
  const members = setMembersOf(operator, value)
  const boundValues = sql.join(
    members.map((v) => sql`${v}`),
    sql`, `
  )
  if (operator === 'in') {
    // An empty IN list is invalid SQL; `IN (NULL)` matches nothing, mirroring intent.
    return members.length === 0 ? sql`${column} IN (NULL)` : sql`${column} IN (${boundValues})`
  }
  return members.length === 0
    ? sql`${column} IS NOT NULL`
    : sql`(${column} IS NOT NULL AND ${column} NOT IN (${boundValues}))`
}

/**
 * Generate a parameterized SQL condition fragment from a filter operator.
 *
 * This is the parameter-binding sibling of `generateSqlCondition`. It returns a
 * Drizzle `SQL` object with bound placeholders for all user-supplied values.
 *
 * Runtime record-filter SELECT path only; DDL callers keep the string-based `generateSqlCondition`.
 *
 * @param dialect - The engine the statement runs on
 * @param field - Column name (must already be validated via validateColumnName)
 * @param operator - Filter operator (equals, greaterThan, contains, in, etc.)
 * @param value - Filter value (bound as a query parameter)
 */
export const generateSqlConditionFragment = (
  dialect: DatabaseDialect,
  field: string,
  operator: string,
  value: unknown
): Readonly<SQL> =>
  conditionFragmentOver(dialect, { field, operator, value }, sql.identifier(field))

/** {@link generateSqlConditionFragment} over `column`: the field, or an expression over it. */
const conditionFragmentOver = (
  dialect: DatabaseDialect,
  leaf: Condition,
  column: SqlIdentifier
): Readonly<SQL> => {
  const { field, operator, value } = leaf
  const translated = translatedTextFragment(dialect, leaf, (inner, over) =>
    conditionFragmentOver(dialect, inner, over)
  )
  if (translated) return translated
  const serverFragment = serverOperatorFragment(dialect, field, operator, value)
  if (serverFragment) return serverFragment
  const patternFragment = buildPatternFragment(column, operator, value)
  if (patternFragment) return patternFragment
  const nullFragment = buildNullFragment(column, operator)
  if (nullFragment) return nullFragment
  const booleanFragment = buildBooleanFragment(column, operator)
  if (booleanFragment) return booleanFragment
  const inFragment = buildInFragment(column, operator, value)
  if (inFragment) return inFragment
  const between = betweenFragment(column, operator, value)
  if (between) return between

  // Comparison operators (equals, notEquals, gt, lt, gte, lte). The SQL
  // operator keyword is static; the value is bound as a parameter.
  const sqlOperator = SQL_OPERATOR_MAP[operator]
  if (sqlOperator === undefined) return unknownOperator(operator)
  // sql-literal: keyword -- `sqlOperator` comes from the closed SQL_OPERATOR_MAP
  return sql`${column} ${sql.raw(sqlOperator)} ${value}`
}
