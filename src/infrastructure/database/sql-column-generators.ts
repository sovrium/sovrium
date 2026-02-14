/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isFormulaVolatile,
  isFormulaReturningArray,
  translateFormulaToPostgres,
} from './formula-utils'
import { isAutoTimestampField, isFieldNotNull, shouldUseSerial } from './sql-field-predicates'
import { mapFieldTypeToPostgres, mapFormulaResultTypeToPostgres } from './sql-type-mappings'
import { escapeSqlString } from './sql-utils'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Format default value for SQL
 * Numbers and booleans are unquoted, strings are quoted and escaped
 */
const formatDefaultValue = (defaultValue: unknown): string => {
  if (typeof defaultValue === 'boolean') {
    return String(defaultValue)
  }
  if (typeof defaultValue === 'number') {
    return String(defaultValue)
  }
  return `'${escapeSqlString(String(defaultValue))}'`
}

/**
 * Generate SERIAL column definition for auto-increment fields
 * When isPrimaryKey is true and it's a single-field PK, add PRIMARY KEY inline for better PostgreSQL constraint recognition
 */
const generateSerialColumn = (fieldName: string, isPrimaryKey: boolean = false): string =>
  isPrimaryKey ? `${fieldName} SERIAL PRIMARY KEY` : `${fieldName} SERIAL NOT NULL`

/**
 * Generate NOT NULL constraint
 */
const generateNotNullConstraint = (
  field: Fields[number],
  isPrimaryKey: boolean,
  hasAuthConfig: boolean = true
): string => {
  return isFieldNotNull(field, isPrimaryKey, hasAuthConfig) ? ' NOT NULL' : ''
}

/**
 * Format array default value as PostgreSQL ARRAY literal
 */
const formatArrayDefault = (defaultValue: readonly unknown[]): string => {
  const arrayValues = defaultValue.map((val) => `'${escapeSqlString(String(val))}'`).join(', ')
  return ` DEFAULT ARRAY[${arrayValues}]`
}

/**
 * Format special default values (PostgreSQL functions, INTERVAL, etc.)
 */
const formatSpecialDefault = (field: Fields[number], defaultValue: unknown): string | undefined => {
  // PostgreSQL functions like CURRENT_DATE, NOW() should not be quoted
  if (typeof defaultValue === 'string' && defaultValue.toUpperCase() === 'CURRENT_DATE') {
    return ' DEFAULT CURRENT_DATE'
  }
  if (typeof defaultValue === 'string' && defaultValue.toUpperCase() === 'NOW()') {
    return ' DEFAULT NOW()'
  }
  // Duration fields: convert seconds to INTERVAL
  if (field.type === 'duration' && typeof defaultValue === 'number') {
    return ` DEFAULT INTERVAL '${defaultValue} seconds'`
  }
  // Array fields (multi-select): convert to PostgreSQL array literal
  if (Array.isArray(defaultValue)) {
    return formatArrayDefault(defaultValue)
  }
  return undefined
}

/**
 * Generate DEFAULT clause
 */
const generateDefaultClause = (field: Fields[number]): string => {
  // Auto-timestamp fields get CURRENT_TIMESTAMP default (PostgreSQL function for current timestamp)
  if (isAutoTimestampField(field)) {
    return ' DEFAULT CURRENT_TIMESTAMP'
  }

  // Progress fields with required=true get DEFAULT 0 automatically
  if (field.type === 'progress' && field.required === true && !('default' in field)) {
    return ' DEFAULT 0'
  }

  // Explicit default values
  if ('default' in field && field.default !== undefined) {
    const defaultValue = field.default
    const specialDefault = formatSpecialDefault(field, defaultValue)
    if (specialDefault) {
      return specialDefault
    }
    return ` DEFAULT ${formatDefaultValue(defaultValue)}`
  }

  return ''
}

/**
 * Generate formula column definition (GENERATED ALWAYS AS or trigger-based)
 *
 * NOTE: Formula fields with volatile functions (CURRENT_DATE, NOW(), etc.) cannot use
 * GENERATED ALWAYS AS because PostgreSQL requires generated columns to be immutable.
 * For volatile formulas, we create regular columns and handle computation via triggers.
 */
const generateFormulaColumn = (
  field: Fields[number] & { readonly type: 'formula'; readonly formula: string },
  allFields?: readonly Fields[number][]
): string => {
  const baseResultType =
    'resultType' in field && field.resultType
      ? mapFormulaResultTypeToPostgres(field.resultType)
      : 'TEXT'

  // Auto-detect array return type for functions like STRING_TO_ARRAY
  // If formula returns an array but resultType doesn't specify array, append []
  const resultType =
    isFormulaReturningArray(field.formula) && !baseResultType.endsWith('[]')
      ? `${baseResultType}[]`
      : baseResultType

  // Translate formula to PostgreSQL syntax with field type context
  // Note: translateFormulaToPostgres handles ROUND with double precision by casting to NUMERIC
  // and converts date::TEXT to TO_CHAR(date, 'format') which is STABLE (not IMMUTABLE)
  const translatedFormula = translateFormulaToPostgres(field.formula, allFields)

  // Volatile formulas (contain CURRENT_DATE, NOW(), etc.) need trigger-based computation
  // because PostgreSQL GENERATED columns must be immutable
  // Check volatility on TRANSLATED formula since date::TEXT becomes TO_CHAR (STABLE)
  if (isFormulaVolatile(translatedFormula)) {
    // Create regular column - trigger will populate it
    return `${field.name} ${resultType}`
  }

  // Immutable formulas can use GENERATED ALWAYS AS
  return `${field.name} ${resultType} GENERATED ALWAYS AS (${translatedFormula}) STORED`
}

/**
 * Generate column definition with constraints
 *
 * NOTE: UNIQUE constraints are NOT generated inline. Named UNIQUE constraints
 * are generated at the table level via generateUniqueConstraints() to ensure
 * they appear in information_schema.table_constraints with queryable constraint names.
 */
export const generateColumnDefinition = (
  field: Fields[number],
  isPrimaryKey: boolean,
  allFields?: readonly Fields[number][],
  hasAuthConfig: boolean = true
): string => {
  // SERIAL columns for auto-increment fields
  if (shouldUseSerial(field, isPrimaryKey)) {
    return generateSerialColumn(field.name, isPrimaryKey)
  }

  // Formula fields: check if formula is volatile
  if (field.type === 'formula' && 'formula' in field && field.formula) {
    return generateFormulaColumn(field, allFields)
  }

  const columnType = mapFieldTypeToPostgres(field)
  const notNull = generateNotNullConstraint(field, isPrimaryKey, hasAuthConfig)
  const defaultValue = generateDefaultClause(field)
  return `${field.name} ${columnType}${notNull}${defaultValue}`
}
