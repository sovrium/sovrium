/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { castDivisionOperands, isNumericFieldRef, numericCastType } from './formula-numeric-cast'

/**
 * Reserved SQL keywords that require escaping when used in identifiers
 * Based on PostgreSQL reserved keywords list
 * @see https://www.postgresql.org/docs/current/sql-keywords-appendix.html
 */
const SQL_RESERVED_KEYWORDS = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'from',
  'where',
  'join',
  'inner',
  'outer',
  'left',
  'right',
  'full',
  'cross',
  'on',
  'as',
  'table',
  'create',
  'alter',
  'drop',
  'truncate',
  'add',
  'column',
  'constraint',
  'primary',
  'foreign',
  'key',
  'references',
  'unique',
  'index',
  'view',
  'database',
  'schema',
  'grant',
  'revoke',
  'transaction',
  'commit',
  'rollback',
  'union',
  'intersect',
  'except',
  'group',
  'having',
  'order',
  'limit',
  'offset',
  'distinct',
  'all',
  'any',
  'some',
  'exists',
  'in',
  'between',
  'like',
  'ilike',
  'and',
  'or',
  'not',
  'null',
  'is',
  'true',
  'false',
  'case',
  'when',
  'then',
  'else',
  'end',
  'cast',
  'default',
  'check',
  'user',
  'current_user',
  'session_user',
  'current_date',
  'current_time',
  'current_timestamp',
])

/**
 * Check if an identifier needs escaping due to reserved words
 * Split identifier by underscores and check if any token is a reserved word
 * Examples:
 * - "order" → needs escaping (is reserved word)
 * - "order_num" → needs escaping (token "order" is reserved)
 * - "created_at" → no escaping ("created" and "at" on their own are not problematic)
 * - "user_id" → needs escaping (token "user" is reserved)
 * - "select" → needs escaping (is reserved word)
 */
const containsReservedWord = (identifier: string): boolean => {
  const lowerIdentifier = identifier.toLowerCase()
  // Check if the identifier itself is a reserved word
  if (SQL_RESERVED_KEYWORDS.has(lowerIdentifier)) {
    return true
  }
  // Split by underscores and check each token
  const tokens = lowerIdentifier.split('_')
  return tokens.some((token) => SQL_RESERVED_KEYWORDS.has(token))
}

/**
 * Escape a field name for use in SQL if it contains reserved words
 * PostgreSQL uses double quotes for identifier escaping
 */
const escapeFieldName = (fieldName: string): string =>
  containsReservedWord(fieldName) ? `"${fieldName}"` : fieldName

/**
 * Volatile SQL functions that cannot be used in GENERATED ALWAYS AS columns
 * These functions return different values on each call or depend on external state
 *
 * NOTE: TO_CHAR is marked as STABLE (not IMMUTABLE) in PostgreSQL because its output
 * can vary based on LC_TIME locale settings, making it unsuitable for GENERATED columns.
 * Formulas using TO_CHAR will use trigger-based computation instead.
 */
const volatileSQLFunctions = [
  'CURRENT_DATE',
  'CURRENT_TIME',
  'CURRENT_TIMESTAMP',
  'NOW()',
  'TIMEOFDAY()',
  'TRANSACTION_TIMESTAMP()',
  'STATEMENT_TIMESTAMP()',
  'CLOCK_TIMESTAMP()',
  'RANDOM()',
  'SETSEED(',
  'DECODE(',
  'CONVERT_FROM(',
  'TO_CHAR(',
  'TO_DATE(',
  'DATE_TRUNC(',
  'ARRAY_TO_STRING(',
]

/**
 * Type casts that make expressions non-immutable in PostgreSQL
 * Casts to TIMESTAMP types depend on locale settings (DateStyle, TimeZone)
 * making them volatile even when used with immutable functions like EXTRACT
 */
const volatileTypeCasts = ['::TIMESTAMP', '::TIMESTAMPTZ', '::DATE', '::TIME']

/**
 * Check if formula contains volatile functions that make it non-immutable
 * PostgreSQL GENERATED ALWAYS AS columns must be immutable (deterministic)
 *
 * Special timestamp fields (created_at, updated_at) are set by triggers, so formulas
 * referencing them must use trigger-based computation, not GENERATED columns
 */
export const isFormulaVolatile = (formula: string): boolean => {
  const upperFormula = formula.toUpperCase()
  return (
    volatileSQLFunctions.some((fn) => upperFormula.includes(fn)) ||
    volatileTypeCasts.some((cast) => upperFormula.includes(cast)) ||
    upperFormula.includes('CREATED_AT') ||
    upperFormula.includes('UPDATED_AT')
  )
}

/**
 * Check if a formula text references a specific field name
 */
const formulaReferencesField = (formula: string, fieldName: string): boolean => {
  const regex = new RegExp(`\\b${fieldName}\\b`, 'i')
  return regex.test(formula)
}

/**
 * Check if a formula field needs trigger-based computation due to formula-to-formula dependencies
 *
 * PostgreSQL GENERATED columns cannot reference other generated columns.
 * This function returns true when:
 * 1. The formula directly references another formula field (e.g., 'doubled * 2' where 'doubled' is formula)
 * 2. The formula field is itself referenced by another formula field that needs trigger-based computation
 *    (transitive: if 'quadrupled' needs trigger because it references 'doubled', then 'doubled' also
 *    needs trigger so the trigger can read its computed value from NEW)
 *
 * @example
 * // fields: base (integer), doubled (formula: base * 2), quadrupled (formula: doubled * 2)
 * isFormulaReferencingFormulaField('doubled * 2', fields) // true (references formula 'doubled')
 * // But 'doubled' must ALSO be trigger-based because it's referenced by trigger-based 'quadrupled'
 * @public
 */
export const isFormulaReferencingFormulaField = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): boolean => {
  if (!allFields) return false

  const formulaFields = allFields.filter(
    (f) =>
      f.type === 'formula' &&
      'formula' in f &&
      typeof (f as { formula?: string }).formula === 'string'
  )

  if (formulaFields.length === 0) return false

  // Check if any formula field name appears in this formula text
  return formulaFields.some((f) => formulaReferencesField(formula, f.name))
}

/**
 * Get the set of formula field names that need trigger-based computation
 * due to formula-to-formula dependencies.
 *
 * This computes the transitive closure: if field B references field A (both formulas),
 * then both A and B need triggers. Field A needs triggers because GENERATED columns
 * are computed after triggers, so B's trigger can't read A's generated value.
 */
export const getFormulaFieldsNeedingTrigger = (
  allFields: readonly { name: string; type: string }[]
): ReadonlySet<string> => {
  const formulaFields = allFields.filter(
    (f): f is { name: string; type: string; formula: string } =>
      f.type === 'formula' &&
      'formula' in f &&
      typeof (f as { formula?: string }).formula === 'string'
  ) as readonly { name: string; type: string; formula: string }[]

  if (formulaFields.length === 0) return new Set()

  // Find formula fields that reference other formula fields
  const directlyNeedsTrigger = new Set(
    formulaFields
      .filter((f) =>
        formulaFields.some(
          (other) => other.name !== f.name && formulaReferencesField(f.formula, other.name)
        )
      )
      .map((f) => f.name)
  )

  if (directlyNeedsTrigger.size === 0) return new Set()

  // Transitively include formula fields that are referenced by trigger-based fields
  // Use recursive expansion until fixed point (no new fields added)
  const expandDependencies = (current: ReadonlySet<string>): ReadonlySet<string> => {
    const expanded = formulaFields.reduce((acc, f) => {
      if (!acc.has(f.name)) return acc
      // Find formula fields referenced by this trigger-based field
      const referencedFormulaFields = formulaFields
        .filter((other) => !acc.has(other.name) && formulaReferencesField(f.formula, other.name))
        .map((other) => other.name)
      return referencedFormulaFields.length > 0
        ? new Set([...acc, ...referencedFormulaFields])
        : acc
    }, current)

    // Fixed point: if no new fields were added, return
    return expanded.size === current.size ? expanded : expandDependencies(expanded)
  }

  return expandDependencies(directlyNeedsTrigger)
}

/**
 * Field types whose values exist ONLY in the table's VIEW (correlated-subquery
 * aliases), never as physical columns on the `<table>_base` table.
 *
 * A `formula` that references any of these cannot be emitted as a base-table
 * `GENERATED ALWAYS AS (…) STORED` column (the referenced column does not exist
 * on the base table). Such a formula must instead be computed in the VIEW.
 */
const VIEW_ONLY_FIELD_TYPES = new Set(['rollup', 'lookup', 'count'])

/**
 * Check if a formula text references at least one VIEW-only field
 * (`rollup` / `lookup` / `count`).
 */
export const formulaReferencesViewOnlyField = (
  formula: string,
  allFields: readonly { name: string; type: string }[]
): boolean =>
  allFields.some(
    (f) => VIEW_ONLY_FIELD_TYPES.has(f.type) && formulaReferencesField(formula, f.name)
  )

/**
 * Get the set of formula field names that must be computed in the VIEW rather
 * than as base-table GENERATED columns.
 *
 * A formula is "view-computed" when it transitively references a VIEW-only
 * field (`rollup`/`lookup`/`count`) — either directly, or via another
 * view-computed formula (formula-over-formula). This is a fixed-point
 * expansion mirroring `getFormulaFieldsNeedingTrigger`: starting from the
 * formulas that reference a view-only field directly, we repeatedly add any
 * formula that references an already-view-computed formula until no new field
 * is added.
 *
 * @example
 * // sum_heures: rollup; total: formula 'sum_heures + 1'; remaining: formula 'prepaid - total'
 * getViewComputedFormulaFields(fields) // Set { 'total', 'remaining' }
 */
export const getViewComputedFormulaFields = (
  allFields: readonly { name: string; type: string }[]
): ReadonlySet<string> => {
  const formulaFields = allFields.filter(
    (f): f is { name: string; type: string; formula: string } =>
      f.type === 'formula' &&
      'formula' in f &&
      typeof (f as { formula?: string }).formula === 'string'
  )

  if (formulaFields.length === 0) return new Set()

  // Seed: formulas that directly reference a view-only (rollup/lookup/count) field.
  const directlyViewComputed = new Set(
    formulaFields
      .filter((f) => formulaReferencesViewOnlyField(f.formula, allFields))
      .map((f) => f.name)
  )

  // Fixed-point: add any formula that references an already-view-computed formula.
  const expand = (current: ReadonlySet<string>): ReadonlySet<string> => {
    const next = formulaFields.reduce((acc, f) => {
      if (acc.has(f.name)) return acc
      const referencesViewComputed = formulaFields.some(
        (other) => acc.has(other.name) && formulaReferencesField(f.formula, other.name)
      )
      return referencesViewComputed ? new Set([...acc, f.name]) : acc
    }, current)
    return next.size === current.size ? next : expand(next)
  }

  return expand(directlyViewComputed)
}

/**
 * Check whether a single field is a view-computed formula (transitively
 * references a rollup/lookup/count field). Convenience wrapper over
 * `getViewComputedFormulaFields` for the column-emission filters.
 */
export const isViewComputedFormula = (
  field: Readonly<{ name: string; type: string }>,
  allFields: readonly { name: string; type: string }[]
): boolean => field.type === 'formula' && getViewComputedFormulaFields(allFields).has(field.name)

/**
 * SQL functions that return array types
 * Used to automatically adjust column type when formula returns an array
 *
 * @example
 * STRING_TO_ARRAY('a,b,c', ',') → ['a', 'b', 'c'] (TEXT[])
 */
const arrayReturningFunctions = ['STRING_TO_ARRAY']

/**
 * Check if formula returns an array type
 * Some PostgreSQL functions return arrays regardless of input type
 * NOTE: ARRAY_TO_STRING wraps an array and returns text, so check for it first
 * NOTE: CARDINALITY wraps an array and returns integer, so check for it too
 */
export const isFormulaReturningArray = (formula: string): boolean => {
  const upperFormula = formula.toUpperCase().trim()

  // If formula starts with ARRAY_TO_STRING, the result is text, not array
  if (upperFormula.startsWith('ARRAY_TO_STRING(')) {
    return false
  }

  // If formula starts with CARDINALITY, the result is integer, not array
  if (upperFormula.startsWith('CARDINALITY(')) {
    return false
  }

  return arrayReturningFunctions.some((fn) => upperFormula.includes(fn))
}

/**
 * Parse ROUND function arguments, handling nested parentheses
 * Returns {firstArg, secondArg, start, end} or undefined if not a valid ROUND call
 */
const parseRoundArgs = (
  formula: string,
  matchIndex: number,
  matchLength: number
):
  | {
      readonly firstArg: string
      readonly secondArg: string
      readonly start: number
      readonly end: number
    }
  | undefined => {
  const argsStart = matchIndex + matchLength
  const chars = [...formula.slice(argsStart)]

  // Track state through the argument parsing
  const state = chars.reduce<{
    depth: number
    firstArgEnd: number
    currentIndex: number
    done: boolean
  }>(
    (acc, char, idx) => {
      if (acc.done) return acc

      const absoluteIndex = argsStart + idx

      if (char === '(') {
        return { ...acc, depth: acc.depth + 1, currentIndex: absoluteIndex }
      }

      if (char === ')') {
        const newDepth = acc.depth - 1
        if (newDepth === 0) {
          return { ...acc, depth: newDepth, currentIndex: absoluteIndex, done: true }
        }
        return { ...acc, depth: newDepth, currentIndex: absoluteIndex }
      }

      if (char === ',' && acc.depth === 1 && acc.firstArgEnd === -1) {
        return { ...acc, firstArgEnd: absoluteIndex, currentIndex: absoluteIndex }
      }

      return { ...acc, currentIndex: absoluteIndex }
    },
    { depth: 1, firstArgEnd: -1, currentIndex: argsStart, done: false }
  )

  if (state.firstArgEnd === -1) return undefined

  return {
    firstArg: formula.slice(argsStart, state.firstArgEnd).trim(),
    secondArg: formula.slice(state.firstArgEnd + 1, state.currentIndex).trim(),
    start: matchIndex,
    end: state.currentIndex + 1,
  }
}

/**
 * Translate date/datetime/time field casts to TEXT using TO_CHAR
 * DATE::TEXT depends on DateStyle (volatile), but TO_CHAR with format is immutable
 */
const translateDateCastsToText = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  if (!allFields) return formula

  return formula.replace(/(\w+)::TEXT/gi, (match, fieldName) => {
    const field = allFields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())
    if (field && (field.type === 'date' || field.type === 'datetime' || field.type === 'time')) {
      // Use appropriate format based on field type
      if (field.type === 'date') {
        return `TO_CHAR(${escapeFieldName(fieldName)}, 'YYYY-MM-DD')`
      }
      if (field.type === 'datetime') {
        return `TO_CHAR(${escapeFieldName(fieldName)}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
      }
      if (field.type === 'time') {
        return `TO_CHAR(${escapeFieldName(fieldName)}, 'HH24:MI:SS')`
      }
    }
    return match // Keep original for non-date fields (e.g., num::TEXT)
  })
}

/**
 * Translate SUBSTR to PostgreSQL SUBSTRING syntax
 * SUBSTR(text, start, length) → SUBSTRING(text FROM start FOR length)
 */
const translateSubstrToSubstring = (formula: string): string =>
  formula.replace(
    /SUBSTR\s*\(\s*([^,]+?)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
    (_, text, start, length) => {
      const trimmedText = text.trim()
      // Only escape if it's a field name (not already a function call or quoted)
      const escapedText = trimmedText.match(/^\w+$/) ? escapeFieldName(trimmedText) : trimmedText
      return `SUBSTRING(${escapedText} FROM ${start} FOR ${length})`
    }
  )

/**
 * Add NUMERIC casts to ROUND functions that use double precision functions
 * PostgreSQL's ROUND(numeric, integer) exists but ROUND(double precision, integer) does not
 */
const addNumericCastsToRound = (formula: string): string => {
  // Find all ROUND( occurrences and build replacement list
  const roundMatches = [...formula.matchAll(/ROUND\s*\(/gi)]
  const replacements = roundMatches
    .map((match) => parseRoundArgs(formula, match.index ?? 0, match[0].length))
    .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== undefined)
    .filter((parsed) => /SQRT|POWER|EXP|LN|LOG/i.test(parsed.firstArg))
    .map((parsed) => ({
      start: parsed.start,
      end: parsed.end,
      replacement: `ROUND((${parsed.firstArg})::NUMERIC, ${parsed.secondArg})`,
    }))

  // Apply replacements in reverse order to maintain indices
  const sortedReplacements = replacements.toSorted((a, b) => b.start - a.start)

  return sortedReplacements.reduce(
    (result, { start, end, replacement }) =>
      result.slice(0, start) + replacement + result.slice(end),
    formula
  )
}

/**
 * Escape field names that contain reserved words
 * This handles references like "order_num * 2" → "\"order_num\" * 2"
 *
 * Shared with the SQLite arm of the translator (`formula-sqlite-translation.ts`):
 * both engines quote identifiers with double quotes, so this pass is
 * dialect-neutral.
 */
export const escapeReservedFieldNames = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  if (!allFields) return formula

  return allFields.reduce((acc, field) => {
    // Only escape this field if it needs escaping
    if (!containsReservedWord(field.name)) {
      return acc
    }

    // Create a regex that matches the field name as a whole word
    // Use word boundaries (\b) to ensure we only match complete field names
    // Use negative lookbehind to avoid matching if already quoted
    const fieldRegex = new RegExp(`(?<!["'])\\b${field.name}\\b(?!["'])`, 'gi')
    return acc.replace(fieldRegex, (match) => escapeFieldName(match))
  }, formula)
}

/**
 * Translate formula from user-friendly syntax to PostgreSQL syntax
 * Converts SUBSTR(text, start, length) to SUBSTRING(text FROM start FOR length)
 * Converts date_field::TEXT to TO_CHAR(date_field, 'YYYY-MM-DD') for immutability
 * Casts ROUND arguments to NUMERIC when input may be double precision
 * Escapes field names that contain reserved words (e.g., order_num → "order_num")
 *
 * NOTE: PostgreSQL natively supports nested function calls like ROUND(SQRT(ABS(value)), 2)
 * and all standard mathematical functions (ABS, SQRT, ROUND, POWER, etc.), but ROUND only
 * accepts NUMERIC as first argument, not double precision. Functions like SQRT, POWER, EXP, LN
 * return double precision, so we cast them to NUMERIC before passing to ROUND.
 */
export const translateFormulaToPostgres = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  const withDateToText = translateDateCastsToText(formula, allFields)
  const withSubstring = translateSubstrToSubstring(withDateToText)
  const withRoundCast = addNumericCastsToRound(withSubstring)
  return escapeReservedFieldNames(withRoundCast, allFields)
}

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
 * Re-export the numeric-cast primitives so existing importers of
 * `./formula-utils` (e.g. the VIEW generator) keep a stable surface. The
 * definitions live in `./formula-numeric-cast` (single source of truth across
 * the GENERATED / TRIGGER / VIEW paths).
 */
export { isNumericFieldRef, numericCastType }

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

/**
 * Wrap numeric column references that are `/` division operands in a numeric
 * CAST so integer-by-integer division does not truncate. Two render modes:
 *
 *  - GENERATED-column path: bare references (`minutes / 60` →
 * `CAST(minutes AS NUMERIC) / 60`) — [internal ref].
 *  - TRIGGER path: alias-qualified references (run AFTER
 *    `qualifyColumnReferences`, `t.total_minutes / 60` →
 *    `CAST(t.total_minutes AS NUMERIC) / 60`) — FORMULA-127.
 *
 * Only `/` operands are cast (see `formula-numeric-cast` docs) so REPEAT/CHR
 * integer args and EXTRACT keywords are untouched.
 */
export const castFormulaDivisionOperands = (
  formula: string,
  allFields: readonly { name: string; type: string; resultType?: string }[],
  prefix?: string
): string =>
  castDivisionOperands(formula, allFields, (name) =>
    prefix !== undefined ? `${prefix}.${name}` : name
  )
