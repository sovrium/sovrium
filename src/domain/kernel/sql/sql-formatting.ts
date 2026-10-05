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
 * Words neither engine accepts as a bare identifier everywhere a name goes: the
 * PostgreSQL reserved key words (including those that may only name a function
 * or a type) and SQLite's key words. A name in this set is quoted even though
 * it has the shape of a plain identifier — `CREATE VIEW all AS …` is a syntax
 * error on both engines, `CREATE VIEW "all" AS …` is not.
 *
 * @see https://www.postgresql.org/docs/current/sql-keywords-appendix.html
 * @see https://www.sqlite.org/lang_keywords.html
 */
const SQL_KEYWORDS: ReadonlySet<string> = new Set(
  [
    // PostgreSQL: reserved
    'all analyse analyze and any array as asc asymmetric both case cast check collate column',
    'constraint create current_catalog current_date current_role current_time current_timestamp',
    'current_user default deferrable desc distinct do else end except false fetch for foreign from',
    'grant group having in initially intersect into lateral leading limit localtime',
    'localtimestamp not null offset on only or order placing primary references returning select',
    'session_user some symmetric system_user table then to trailing true union unique user using',
    'variadic when where window with',
    // PostgreSQL: reserved, but allowed as a function or type name
    'authorization binary collation concurrently cross current_schema freeze full ilike inner is',
    'isnull join left like natural notnull outer overlaps right similar tablesample verbose',
    // SQLite
    'abort action add after alter always attach autoincrement before begin between by cascade',
    'commit conflict current database deferred delete detach drop each escape exclude exclusive',
    'exists explain fail filter first following generated glob groups if ignore immediate index',
    'indexed insert instead key last match materialized no nothing nulls of others over',
    'partition plan pragma preceding query raise range recursive regexp reindex release rename',
    'replace restrict rollback row rows savepoint set temp temporary ties transaction trigger',
    'unbounded update vacuum values view virtual without',
  ].flatMap((line) => line.split(' '))
)

/**
 * Quote a SQL identifier (table/view/column name) only when it needs it.
 *
 * A plain unquoted identifier must match `[a-z_][a-z0-9_]*` AND not be a key
 * word. Anything else (hyphens, leading digits, uppercase, key words such as
 * `all` or `order`) is double-quoted. View IDs accept kebab-case (e.g.
 * `active-orders`), so an unquoted `CREATE VIEW active-orders` produces
 * `syntax error at or near "-"`; a view id `all` produced `near "all"`.
 *
 * Identifiers that are already valid bare identifiers are returned unchanged
 * so existing snake_case names (`test_view`, `idx_orders_status`) keep their
 * unquoted form. Embedded double-quotes are doubled per the SQL standard. A
 * quoted lowercase name is the same name as its bare form on both engines, so
 * quoting never renames anything.
 */
export const quoteSqlIdentifier = (identifier: string): string => {
  if (/^[a-z_][a-z0-9_]*$/.test(identifier) && !SQL_KEYWORDS.has(identifier)) {
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
