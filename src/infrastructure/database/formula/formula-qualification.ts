/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * EXTRACT date/time field keywords that should not be qualified
 * These are valid arguments to EXTRACT() function and not column references
 */
const EXTRACT_KEYWORDS = new Set([
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
  'dow',
  'doy',
  'week',
  'quarter',
  'decade',
  'century',
  'millennium',
  'epoch',
  'timezone',
  'timezone_hour',
  'timezone_minute',
])

/**
 * Qualify column references in a formula with a prefix
 * Used by trigger functions to reference columns from subqueries or NEW/OLD records
 *
 * Pure qualification only — the numeric-division CAST is applied as a separate
 * post-pass (`castDivisionOperands`) so it operates on the already-qualified
 * `t.<field>` references without disturbing EXTRACT keywords or function args.
 *
 * @example
 * qualifyColumnReferences('NOT paid AND due_date < CURRENT_DATE', fields, 't')
 * // Returns: 'NOT t.paid AND t.due_date < CURRENT_DATE'
 *
 * @example
 * qualifyColumnReferences('EXTRACT(HOUR FROM timestamp_value::TIMESTAMP)', fields, 't')
 * // Returns: 'EXTRACT(HOUR FROM t.timestamp_value::TIMESTAMP)' (HOUR not qualified)
 */
export const qualifyColumnReferences = (
  formula: string,
  allFields: readonly { name: string; type: string }[],
  prefix: string
): string => rewriteOutsideStringLiterals(formula, (code) => qualifyCode(code, allFields, prefix))

/**
 * Apply `rewrite` to the code of `sql`, never inside a single-quoted literal
 * (`'it''s'` included): `'Due ' || due` keeps its `Due`, not the `due` column.
 */
export const rewriteOutsideStringLiterals = (
  sql: string,
  rewrite: (code: string) => string
): string =>
  sql
    .split(/('(?:[^']|'')*')/)
    .map((part, index) => (index % 2 === 1 ? part : rewrite(part)))
    .join('')

const qualifyCode = (
  formula: string,
  allFields: readonly { name: string; type: string }[],
  prefix: string
): string =>
  allFields.reduce((acc, field) => {
    // Don't qualify EXTRACT keywords (e.g., HOUR, MINUTE, DAY)
    if (EXTRACT_KEYWORDS.has(field.name.toLowerCase())) {
      // Check if this field name appears as an EXTRACT keyword
      const extractPattern = new RegExp(`\\bEXTRACT\\s*\\(\\s*${field.name}\\s+FROM\\b`, 'gi')
      if (extractPattern.test(acc)) {
        // This is an EXTRACT keyword, only qualify non-keyword occurrences
        // Match the field name but exclude it when preceded by EXTRACT(
        const fieldRegex = new RegExp(
          `(?<!EXTRACT\\s{0,10}\\(\\s{0,10})(?<![."])\\b${field.name}\\b(?!["'(]|\\s+FROM)`,
          'gi'
        )
        return acc.replace(fieldRegex, `${prefix}.${field.name}`)
      }
    }

    // Create regex that matches field name as a whole word
    // Use word boundaries (\b) and negative lookbehind for dots (avoid double-qualifying)
    // Use negative lookahead for '(' to avoid qualifying SQL function names that match field names
    // Example: field "age" should not turn AGE(...) into t.AGE(...) which causes "schema t does not exist"
    const fieldRegex = new RegExp(`(?<![."])\\b${field.name}\\b(?!["'(])`, 'gi')
    return acc.replace(fieldRegex, `${prefix}.${field.name}`)
  }, formula)
