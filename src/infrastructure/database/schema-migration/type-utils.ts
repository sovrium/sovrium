/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapFieldTypeToPostgres } from '../sql/sql-generators'
import type { Fields } from '@/domain/models/app/tables/fields'

const normalizeTimestampType = (normalized: string): string => {
  if (normalized.startsWith('timestamptz')) return 'timestamptz'
  if (normalized.includes('without time zone')) return 'timestamp'
  if (normalized.includes('with time zone')) return 'timestamptz'
  return 'timestamp'
}

export const normalizeDataType = (dataType: string): string => {
  const normalized = dataType.toLowerCase().trim()

  if (normalized.startsWith('character varying')) return 'varchar'
  if (normalized.startsWith('timestamp')) return normalizeTimestampType(normalized)
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

const TEXT_CASTABLE_TIMESTAMP_TARGETS: ReadonlySet<string> = new Set(['timestamp', 'timestamptz'])

const resolveUsingClause = (
  columnName: string,
  targetType: string,
  normalizedExisting: string,
  normalizedTarget: string
): string => {
  if (normalizedExisting === 'text' && normalizedTarget === 'varchar') {
    const lengthMatch = targetType.match(/VARCHAR\((\d+)\)/)
    const length = lengthMatch ? lengthMatch[1] : '255'
    return ` USING LEFT(${columnName}, ${length})`
  }

  if (normalizedExisting === 'text' && normalizedTarget === 'integer') {
    return ` USING ${columnName}::INTEGER`
  }

  if (normalizedExisting === 'text' && TEXT_CASTABLE_TIMESTAMP_TARGETS.has(normalizedTarget)) {
    return ` USING ${columnName}::TIMESTAMPTZ`
  }

  if (normalizedExisting === 'timestamp' && normalizedTarget === 'timestamptz') {
    return ''
  }

  return ''
}

export const generateAlterColumnTypeStatement = (
  tableName: string,
  field: Fields[number],
  existingDataType: string
): string => {
  const targetType = mapFieldTypeToPostgres(field)
  const usingClause = resolveUsingClause(
    field.name,
    targetType,
    normalizeDataType(existingDataType),
    normalizeDataType(targetType)
  )

  return `ALTER TABLE ${tableName} ALTER COLUMN ${field.name} TYPE ${targetType}${usingClause}`
}

export const isGatedTimestamptzConversion = (
  field: Fields[number],
  existingDataType: string
): boolean =>
  normalizeDataType(existingDataType) === 'timestamp' &&
  normalizeDataType(mapFieldTypeToPostgres(field)) === 'timestamptz'
