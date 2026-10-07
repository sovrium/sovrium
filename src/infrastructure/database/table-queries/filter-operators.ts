/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { LIKE_ESCAPE_CHARACTER, escapeLikeMetacharacters } from '@/domain/kernel/sql/sql-formatting'
import { formatSqlValue, formatLikePattern, escapeSqlString } from '../sql/sql-utils'

/**
 * Return type of `sql.identifier()` — a safely-escaped SQL identifier chunk.
 */
type SqlIdentifier = Readonly<ReturnType<typeof sql.identifier>>

/**
 * SQL operator mapping for comparison operators
 * Maps domain filter operators to SQL comparison operators
 */
export const SQL_OPERATOR_MAP: Readonly<Record<string, string>> = {
  equals: '=',
  notEquals: '!=',
  greaterThan: '>',
  lessThan: '<',
  greaterThanOrEqual: '>=',
  lessThanOrEqual: '<=',
}

/**
 * Handle LIKE pattern operators (contains, startsWith, endsWith)
 *
 * Case-folded on BOTH sides — see the DECISION note further down this file. A
 * bare `LIKE` here is not a neutral choice: it is case-SENSITIVE on PostgreSQL
 * and case-INSENSITIVE on SQLite, so the same view definition selects different
 * rows on the two engines.
 */
const handlePatternOperator = (
  field: string,
  operator: string,
  value: unknown
): string | undefined => {
  if (operator === 'contains' || operator === 'startsWith' || operator === 'endsWith') {
    return `LOWER(${field}) LIKE LOWER(${formatLikePattern(value, operator)})`
  }
  return undefined
}

/**
 * The texts an empty value reads as once cast to text — the inline twin of
 * `EMPTY_VALUE_TEXTS` below, for DDL where nothing can be bound. Constant
 * literals: no configured value reaches this string.
 */
const EMPTY_VALUE_TEXTS_LITERAL = "('', '[]', '{}')"

/**
 * Handle NULL check operators (isNull, isNotNull, isEmpty, isNotEmpty)
 *
 * `isEmpty` / `isNotEmpty` compile to exactly the condition the parameterised
 * {@link emptyValueCondition} emits: NULL, or the column cast to
 * text reads `''`, `'[]'` or `'{}'`. Comparing as TEXT is what lets one
 * condition read a PostgreSQL array (an empty `TEXT[]` casts to `{}`), a JSON
 * column and plain text on both engines — a bare `= ''` against an array
 * column is a `malformed array literal` on PostgreSQL.
 */
const handleNullOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isNull') {
    return `${field} IS NULL`
  }
  if (operator === 'isNotNull') {
    return `${field} IS NOT NULL`
  }
  if (operator === 'isEmpty') {
    return `(${field} IS NULL OR CAST(${field} AS TEXT) IN ${EMPTY_VALUE_TEXTS_LITERAL})`
  }
  if (operator === 'isNotEmpty') {
    return `(${field} IS NOT NULL AND CAST(${field} AS TEXT) NOT IN ${EMPTY_VALUE_TEXTS_LITERAL})`
  }
  return undefined
}

/**
 * Handle boolean operators (isTrue, isFalse)
 */
const handleBooleanOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isTrue') {
    return `${field} = true`
  }
  if (operator === 'isFalse') {
    return `${field} = false`
  }
  return undefined
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
const setMembersOf = (operator: 'in' | 'notIn', value: unknown): readonly unknown[] => {
  const members = Array.isArray(value) ? value : [value]
  return operator === 'notIn'
    ? members.filter((member) => member !== null && member !== undefined)
    : members
}

/** Whether an operator is one of the two set-membership operators. */
const isSetOperator = (operator: string): operator is 'in' | 'notIn' =>
  operator === 'in' || operator === 'notIn'

/**
 * Handle the set-membership operators `in` and `notIn`.
 *
 * A row with no value is kept by neither: `in` cannot match NULL, and `notIn`
 * states `IS NOT NULL` rather than leaving it to `NOT IN`'s three-valued logic,
 * so the rule reads the same on both engines. An empty `notIn` list leaves out
 * nothing that has a value — where SQL's `NOT IN (NULL)` would leave out every
 * row. See {@link setMembersOf} for a single value and a null member.
 */
const handleInOperator = (field: string, operator: string, value: unknown): string | undefined => {
  if (!isSetOperator(operator)) return undefined
  const formattedValues = setMembersOf(operator, value).map((v) => formatSqlValue(v))
  if (operator === 'in') {
    return formattedValues.length === 0 ? '1 = 0' : `${field} IN (${formattedValues.join(', ')})`
  }
  return formattedValues.length === 0
    ? `${field} IS NOT NULL`
    : `(${field} IS NOT NULL AND ${field} NOT IN (${formattedValues.join(', ')}))`
}

/**
 * Format value based on options
 */
const formatValue = (value: unknown, useEscapeSqlString: boolean): string => {
  if (useEscapeSqlString && typeof value === 'string') {
    return `'${escapeSqlString(value)}'`
  }
  return formatSqlValue(value)
}

/**
 * Generate SQL condition from filter operator and value
 * Handles both simple operators (equals, greaterThan, etc.) and pattern matching (contains, startsWith, etc.)
 *
 * @param field - Column name or expression
 * @param operator - Filter operator (equals, greaterThan, contains, etc.)
 * @param value - Filter value
 * @param options - Optional configuration
 * @param options.useEscapeSqlString - Use escapeSqlString instead of formatSqlValue for string values (for manual string formatting)
 * @returns SQL condition string
 */
export const generateSqlCondition = (
  field: string,
  operator: string,
  value: unknown,
  options: { readonly useEscapeSqlString?: boolean } = {}
): string => {
  const useEscapeSqlString = options.useEscapeSqlString ?? false

  // Handle LIKE pattern operators
  const patternCondition = handlePatternOperator(field, operator, value)
  if (patternCondition) return patternCondition

  // Handle NULL operators
  const nullCondition = handleNullOperator(field, operator)
  if (nullCondition) return nullCondition

  // Handle boolean operators
  const booleanCondition = handleBooleanOperator(field, operator)
  if (booleanCondition) return booleanCondition

  // Handle IN operator
  const inCondition = handleInOperator(field, operator, value)
  if (inCondition) return inCondition

  // Handle comparison operators
  const sqlOperator = SQL_OPERATOR_MAP[operator]
  if (sqlOperator) {
    const formattedValue = formatValue(value, useEscapeSqlString)
    return `${field} ${sqlOperator} ${formattedValue}`
  }

  // Fallback to equals if operator not recognized
  const formattedValue = formatValue(value, useEscapeSqlString)
  return `${field} = ${formattedValue}`
}

// ---------------------------------------------------------------------------
// Parameterized fragment builder (RUNTIME query path only)
//
// The functions above (generateSqlCondition + the string handlers) build raw
// SQL strings. They MUST keep working: they are consumed by DDL generators
// (view-generators, lookup-* generators) where bound parameters are illegal.
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

// The LIKE escape character and the metacharacter-escaping routine are IMPORTED
// from `sql/dialect-sql-helpers`, not restated here. This path is where they
// were first worked out; the command-palette / trash / user-directory helper
// (`containsInsensitive`) then needed exactly the same rule, and a second copy
// of a rule that decides which rows a search returns is how the two spellings
// drift apart. One definition, two consumers.

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
    return undefined
  }
  const stringValue = escapeLikeMetacharacters(typeof value === 'string' ? value : String(value))
  const pattern =
    operator === 'contains'
      ? `%${stringValue}%`
      : operator === 'startsWith'
        ? `${stringValue}%`
        : `%${stringValue}`
  // sql-literal: keyword -- the escape character is a module constant
  return sql`lower(${column}) LIKE lower(${pattern}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`
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
 * {@link handleInOperator}, and {@link setMembersOf} for a single value).
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
 * Use this for the runtime record-filter SELECT path. DDL callers must keep
 * using the string-based `generateSqlCondition`.
 *
 * @param field - Column name (must already be validated via validateColumnName)
 * @param operator - Filter operator (equals, greaterThan, contains, in, etc.)
 * @param value - Filter value (bound as a query parameter)
 * @returns Drizzle SQL fragment with bound parameters
 */
export const generateSqlConditionFragment = (
  field: string,
  operator: string,
  value: unknown
): Readonly<SQL> => {
  const column = sql.identifier(field)

  const patternFragment = buildPatternFragment(column, operator, value)
  if (patternFragment) return patternFragment

  const nullFragment = buildNullFragment(column, operator)
  if (nullFragment) return nullFragment

  const booleanFragment = buildBooleanFragment(column, operator)
  if (booleanFragment) return booleanFragment

  const inFragment = buildInFragment(column, operator, value)
  if (inFragment) return inFragment

  // Comparison operators (equals, notEquals, gt, lt, gte, lte) and fallback.
  // The SQL operator keyword is static; the value is bound as a parameter.
  const sqlOperator = SQL_OPERATOR_MAP[operator] ?? '='
  // sql-literal: keyword -- `sqlOperator` comes from the closed SQL_OPERATOR_MAP
  return sql`${column} ${sql.raw(sqlOperator)} ${value}`
}
