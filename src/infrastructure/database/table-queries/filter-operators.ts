/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { LIKE_ESCAPE_CHARACTER, escapeLikeMetacharacters } from '../sql/dialect-sql-helpers'
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
 * Handle NULL check operators (isNull, isNotNull, isEmpty)
 */
const handleNullOperator = (field: string, operator: string): string | undefined => {
  if (operator === 'isNull') {
    return `${field} IS NULL`
  }
  if (operator === 'isNotNull') {
    return `${field} IS NOT NULL`
  }
  if (operator === 'isEmpty') {
    return `(${field} IS NULL OR ${field} = '')`
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
 * Handle IN operator (field matches any value in array)
 */
const handleInOperator = (field: string, operator: string, value: unknown): string | undefined => {
  if (operator === 'in') {
    if (!Array.isArray(value)) {
      return undefined
    }
    // Format each value in the array immutably
    const formattedValues = value.map((v) => formatSqlValue(v))
    return `${field} IN (${formattedValues.join(', ')})`
  }
  return undefined
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
  return sql`lower(${column}) LIKE lower(${pattern}) ESCAPE ${sql.raw(`'${LIKE_ESCAPE_CHARACTER}'`)}`
}

/**
 * Build a parameterized NULL/empty check fragment (isNull/isNotNull/isEmpty).
 * These reference only the column; no value binding needed.
 */
const buildNullFragment = (column: SqlIdentifier, operator: string): Readonly<SQL> | undefined => {
  if (operator === 'isNull') {
    return sql`${column} IS NULL`
  }
  if (operator === 'isNotNull') {
    return sql`${column} IS NOT NULL`
  }
  if (operator === 'isEmpty') {
    return sql`(${column} IS NULL OR ${column} = '')`
  }
  return undefined
}

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
 * Build a parameterized IN fragment. Each array value is bound individually.
 */
const buildInFragment = (
  column: SqlIdentifier,
  operator: string,
  value: unknown
): Readonly<SQL> | undefined => {
  if (operator !== 'in') return undefined
  if (!Array.isArray(value)) return undefined
  // An empty IN list is invalid SQL; `IN (NULL)` matches nothing, mirroring intent.
  if (value.length === 0) return sql`${column} IN (NULL)`
  const boundValues = sql.join(
    value.map((v) => sql`${v}`),
    sql`, `
  )
  return sql`${column} IN (${boundValues})`
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
  return sql`${column} ${sql.raw(sqlOperator)} ${value}`
}
