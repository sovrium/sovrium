/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
 * Translate formula from user-friendly syntax to PostgreSQL syntax
 * Converts SUBSTR(text, start, length) to SUBSTRING(text FROM start FOR length)
 * Converts date_field::TEXT to TO_CHAR(date_field, 'YYYY-MM-DD') for immutability
 *
 * NOTE: PostgreSQL natively supports nested function calls like ROUND(SQRT(ABS(value)), 2)
 * and all standard mathematical functions (ABS, SQRT, ROUND, POWER, etc.), so they don't
 * need translation and are passed through unchanged.
 */
export const translateFormulaToPostgres = (
  formula: string,
  allFields?: readonly { name: string; type: string }[]
): string => {
  // Translate date/datetime/time field casts to TEXT using TO_CHAR
  // DATE::TEXT depends on DateStyle (volatile), but TO_CHAR with format is immutable
  const withDateToText = allFields
    ? formula.replace(/(\w+)::TEXT/gi, (match, fieldName) => {
        const field = allFields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())
        if (field && (field.type === 'date' || field.type === 'datetime' || field.type === 'time')) {
          // Use appropriate format based on field type
          if (field.type === 'date') {
            return `TO_CHAR(${fieldName}, 'YYYY-MM-DD')`
          }
          if (field.type === 'datetime') {
            return `TO_CHAR(${fieldName}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
          }
          if (field.type === 'time') {
            return `TO_CHAR(${fieldName}, 'HH24:MI:SS')`
          }
        }
        return match // Keep original for non-date fields (e.g., num::TEXT)
      })
    : formula

  // SUBSTR(text, start, length) → SUBSTRING(text FROM start FOR length)
  return withDateToText.replace(
    /SUBSTR\s*\(\s*([^,]+?)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
    (_, text, start, length) => `SUBSTRING(${text.trim()} FROM ${start} FOR ${length})`
  )
}
