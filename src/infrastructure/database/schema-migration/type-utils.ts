/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapFieldTypeToPostgres } from '../sql/sql-generators'
import type { Fields } from '@/domain/models/app/tables/fields'

export const normalizeDataType = (dataType: string): string => {
  const normalized = dataType.toLowerCase().trim()

  if (normalized.startsWith('character varying')) return 'varchar'
  if (normalized.startsWith('timestamp')) return 'timestamp'
  if (normalized.startsWith('numeric') || normalized.startsWith('decimal')) return 'numeric'

  if (normalized === 'array') return 'text[]'

  const withoutLength = normalized.replace(/\([^)]*\)/, '')

  return withoutLength
}

export const doesColumnTypeMatch = (field: Fields[number], existingDataType: string): boolean => {
  const expectedType = mapFieldTypeToPostgres(field)
  const normalizedExpected = normalizeDataType(expectedType)
  const normalizedExisting = normalizeDataType(existingDataType)

  if (
    (normalizedExpected === 'varchar' || normalizedExpected === 'text') &&
    (normalizedExisting === 'varchar' || normalizedExisting === 'text')
  ) {
    return normalizedExpected === normalizedExisting
  }

  return normalizedExpected === normalizedExisting
}

export const generateAlterColumnTypeStatement = (
  tableName: string,
  field: Fields[number],
  existingDataType: string
): string => {
  const targetType = mapFieldTypeToPostgres(field)
  const normalizedTarget = normalizeDataType(targetType)
  const normalizedExisting = normalizeDataType(existingDataType)

  const usingClause = (() => {
    if (normalizedExisting === 'text' && normalizedTarget === 'varchar') {
      const lengthMatch = targetType.match(/VARCHAR\((\d+)\)/)
      const length = lengthMatch ? lengthMatch[1] : '255'
      return ` USING LEFT(${field.name}, ${length})`
    }

    if (normalizedExisting === 'text' && normalizedTarget === 'integer') {
      return ` USING ${field.name}::INTEGER`
    }

    if (normalizedExisting === 'text' && normalizedTarget === 'timestamp') {
      return ` USING ${field.name}::TIMESTAMPTZ`
    }

    if (normalizedExisting === 'integer' && normalizedTarget === 'numeric') {
      return ''
    }

    return ''
  })()

  return `ALTER TABLE ${tableName} ALTER COLUMN ${field.name} TYPE ${targetType}${usingClause}`
}
