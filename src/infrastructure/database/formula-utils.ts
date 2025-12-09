/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
 */
export const isFormulaVolatile = (formula: string): boolean => {
  const upperFormula = formula.toUpperCase()
  return (
    volatileSQLFunctions.some((fn) => upperFormula.includes(fn)) ||
    volatileTypeCasts.some((cast) => upperFormula.includes(cast))
  )
}

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
  | { readonly firstArg: string; readonly secondArg: string; readonly start: number; readonly end: number }
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
      const escapedText =
        trimmedText.match(/^\w+$/) ? escapeFieldName(trimmedText) : trimmedText
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
    (result, { start, end, replacement }) => result.slice(0, start) + replacement + result.slice(end),
    formula
  )
}

/**
 * Escape field names that contain reserved words
 * This handles references like "order_num * 2" → "\"order_num\" * 2"
 */
const escapeReservedFieldNames = (
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
