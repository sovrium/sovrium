/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapFieldTypeToPostgres } from '../sql/sql-generators'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Normalize PostgreSQL data type for comparison
 * Maps similar types to a canonical form (e.g., 'varchar' and 'character varying' both map to 'varchar')
 * Strips length specifiers and precision for type matching
 */
export const normalizeDataType = (dataType: string): string => {
  const normalized = dataType.toLowerCase().trim()

  // Map 'character varying' to 'varchar' for easier comparison
  if (normalized.startsWith('character varying')) return 'varchar'
  if (normalized.startsWith('timestamp')) return 'timestamp'
  if (normalized.startsWith('numeric') || normalized.startsWith('decimal')) return 'numeric'

  // Map PostgreSQL ARRAY type to text[] for comparison with field type mappings
  // information_schema.columns returns 'ARRAY' for all array columns
  if (normalized === 'array') return 'text[]'

  // Strip length specifiers for varchar, char, etc.
  // varchar(255) → varchar, char(10) → char, numeric(10,2) → numeric
  const withoutLength = normalized.replace(/\([^)]*\)/, '')

  return withoutLength
}

/**
 * Check if column data type matches the expected type from schema
 */
export const doesColumnTypeMatch = (field: Fields[number], existingDataType: string): boolean => {
  const expectedType = mapFieldTypeToPostgres(field)
  const normalizedExpected = normalizeDataType(expectedType)
  const normalizedExisting = normalizeDataType(existingDataType)

  // For varchar/text types, check if both are string types
  if (
    (normalizedExpected === 'varchar' || normalizedExpected === 'text') &&
    (normalizedExisting === 'varchar' || normalizedExisting === 'text')
  ) {
    // Match if both are string types (varchar/text are interchangeable for our purposes)
    return normalizedExpected === normalizedExisting
  }

  // For other types, exact match required
  return normalizedExpected === normalizedExisting
}

/**
 * Generate ALTER COLUMN TYPE statement with USING clause if needed
 * Handles type conversions that require explicit casting or transformation
 */
export const generateAlterColumnTypeStatement = (
  tableName: string,
  field: Fields[number],
  existingDataType: string
): string => {
  const targetType = mapFieldTypeToPostgres(field)
  const normalizedTarget = normalizeDataType(targetType)
  const normalizedExisting = normalizeDataType(existingDataType)

  // Determine if USING clause is needed for type conversion
  const usingClause = (() => {
    // TEXT → VARCHAR requires LEFT() to truncate
    if (normalizedExisting === 'text' && normalizedTarget === 'varchar') {
      const lengthMatch = targetType.match(/VARCHAR\((\d+)\)/)
      const length = lengthMatch ? lengthMatch[1] : '255'
      return ` USING LEFT(${field.name}, ${length})`
    }

    // TEXT → INTEGER requires explicit cast
    if (normalizedExisting === 'text' && normalizedTarget === 'integer') {
      return ` USING ${field.name}::INTEGER`
    }

    // TEXT → TIMESTAMP requires explicit cast
    if (normalizedExisting === 'text' && normalizedTarget === 'timestamp') {
      return ` USING ${field.name}::TIMESTAMPTZ`
    }

    // INTEGER → NUMERIC conversion (automatic, no USING clause needed)
    // PostgreSQL can implicitly convert INTEGER to NUMERIC
    if (normalizedExisting === 'integer' && normalizedTarget === 'numeric') {
      return ''
    }

    return ''
  })()

  return `ALTER TABLE ${tableName} ALTER COLUMN ${field.name} TYPE ${targetType}${usingClause}`
}
