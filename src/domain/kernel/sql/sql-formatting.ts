/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Escape single quotes in SQL string literals to prevent SQL injection
 * PostgreSQL escapes single quotes by doubling them: ' becomes ''
 *
 * Used across all SQL generators (view-generators, lookup-view-generators, sql-generators)
 */
export const escapeSqlString = (value: string): string => value.replace(/'/g, "''")

/**
 * Quote a SQL identifier (table/view/column name) only when PostgreSQL
 * requires it.
 *
 * A plain unquoted identifier in PostgreSQL must match `[a-z_][a-z0-9_]*`.
 * Anything else (hyphens, leading digits, uppercase, reserved words) needs
 * double-quoting. View IDs accept kebab-case (e.g. `active-orders`), so an
 * unquoted `CREATE VIEW active-orders` produces `syntax error at or near "-"`.
 *
 * Identifiers that are already valid bare identifiers are returned unchanged
 * so existing snake_case names (`test_view`, `idx_orders_status`) keep their
 * unquoted form. Embedded double-quotes are doubled per the SQL standard.
 */
export const quoteSqlIdentifier = (identifier: string): string => {
  if (/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    return identifier
  }
  return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * Format a value for SQL interpolation with proper escaping
 * Strings are escaped and quoted, numbers/booleans are used directly
 */
export const formatSqlValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return `'${escapeSqlString(value)}'`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null) {
    return 'NULL'
  }
  // For other types (objects, arrays), convert to JSON string
  return `'${escapeSqlString(JSON.stringify(value))}'`
}

/**
 * Generate SQL LIKE pattern with wildcards for pattern matching operators
 * Automatically escapes the value to prevent SQL injection
 */
export const formatLikePattern = (
  value: unknown,
  pattern: 'contains' | 'startsWith' | 'endsWith'
): string => {
  const stringValue = typeof value === 'string' ? value : String(value)
  const escaped = escapeSqlString(stringValue)

  switch (pattern) {
    case 'contains':
      return `'%${escaped}%'`
    case 'startsWith':
      return `'${escaped}%'`
    case 'endsWith':
      return `'%${escaped}'`
  }
}

/**
 * The character that introduces an escape inside a SQL `LIKE` pattern.
 *
 * Declared EXPLICITLY, via an `ESCAPE` clause, because the dialects do not agree
 * on a default: PostgreSQL treats a backslash as an escape in `LIKE` out of the
 * box, SQLite has no default escape character at all. Relying on either default
 * makes the same search return different rows on the two engines.
 *
 * The two halves ship together or not at all. Escaping metacharacters WITHOUT
 * declaring `ESCAPE` is not a harmless half-measure: measured against
 * `bun:sqlite`, a pattern of `%50\%%` with no `ESCAPE` clause returns ZERO rows,
 * trading an over-match for a silent false negative — a worse failure than the
 * one being fixed, because it is invisible.
 */
export const LIKE_ESCAPE_CHARACTER = '\\'

/**
 * Neutralise the LIKE metacharacters in a caller's search text.
 *
 * A substring search promises to match TEXT, so `%` and `_` in the caller's
 * value are ordinary characters they are looking for — not wildcards they are
 * asking for. Leaking them inverts the operator: `%` matches every non-null row
 * (a search that answers "everything" answers nothing), `_` matches any single
 * character, and text that genuinely contains either becomes unsearchable.
 *
 * The escape character is escaped FIRST — that is what the single-pass regex
 * buys, and it is the part a re-derivation gets wrong. A caller's own backslash
 * (a Windows path is the everyday case) survives as a literal instead of
 * consuming the character after it.
 */
export const escapeLikeMetacharacters = (value: string): string =>
  value.replace(/[\\%_]/g, (character) => `${LIKE_ESCAPE_CHARACTER}${character}`)
