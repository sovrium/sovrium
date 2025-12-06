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
]

/**
 * Check if formula contains volatile functions that make it non-immutable
 * PostgreSQL GENERATED ALWAYS AS columns must be immutable (deterministic)
 */
export const isFormulaVolatile = (formula: string): boolean => {
  const upperFormula = formula.toUpperCase()
  return volatileSQLFunctions.some((fn) => upperFormula.includes(fn))
}

/**
 * Translate formula from user-friendly syntax to PostgreSQL syntax
 * Converts SUBSTR(text, start, length) to SUBSTRING(text FROM start FOR length)
 */
export const translateFormulaToPostgres = (formula: string): string => {
  // SUBSTR(text, start, length) → SUBSTRING(text FROM start FOR length)
  return formula.replace(
    /SUBSTR\s*\(\s*([^,]+?)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi,
    (_, text, start, length) => `SUBSTRING(${text.trim()} FROM ${start} FOR ${length})`
  )
}
