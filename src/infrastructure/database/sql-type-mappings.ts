/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Field type to PostgreSQL type mapping
 * Note: button field type is included for type safety but should not create database columns
 */
export const fieldTypeToPostgresMap: Record<string, string> = {
  integer: 'INTEGER',
  autonumber: 'INTEGER',
  decimal: 'DECIMAL',
  'single-line-text': 'VARCHAR(50)',
  'long-text': 'TEXT',
  email: 'VARCHAR(255)',
  url: 'VARCHAR(255)',
  'phone-number': 'VARCHAR(255)',
  'rich-text': 'TEXT',
  checkbox: 'BOOLEAN',
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  time: 'TIME',
  'single-select': 'VARCHAR(255)',
  status: 'VARCHAR(255)',
  'multi-select': 'TEXT[]',
  currency: 'DECIMAL',
  percentage: 'DECIMAL',
  rating: 'INTEGER',
  duration: 'INTERVAL',
  color: 'VARCHAR(7)',
  progress: 'INTEGER',
  json: 'JSONB',
  geolocation: 'POINT',
  barcode: 'VARCHAR(255)',
  'single-attachment': 'VARCHAR(255)',
  'multiple-attachments': 'JSONB',
  relationship: 'INTEGER',
  lookup: 'TEXT',
  rollup: 'TEXT',
  count: 'INTEGER',
  formula: 'TEXT',
  user: 'TEXT',
  'created-by': 'TEXT',
  'updated-by': 'TEXT',
  'deleted-by': 'TEXT',
  'created-at': 'TIMESTAMP',
  'updated-at': 'TIMESTAMP',
  'deleted-at': 'TIMESTAMP',
  button: 'TEXT',
}

/**
 * Map formula resultType to PostgreSQL type
 */
const formulaResultTypeMap: Record<string, string> = {
  decimal: 'DECIMAL',
  number: 'DECIMAL',
  numeric: 'DECIMAL',
  integer: 'INTEGER',
  int: 'INTEGER',
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',
  text: 'TEXT',
  string: 'TEXT',
  'text[]': 'TEXT[]',
  'string[]': 'TEXT[]',
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  timestamp: 'TIMESTAMPTZ',
}

export const mapFormulaResultTypeToPostgres = (resultType: string | undefined): string => {
  if (!resultType) return 'TEXT'
  return formulaResultTypeMap[resultType.toLowerCase()] ?? 'TEXT'
}

/**
 * Map field type to PostgreSQL column type
 * Throws error if field type is not recognized
 */
export const mapFieldTypeToPostgres = (field: Fields[number]): string => {
  if (field.type === 'array') {
    const itemType = 'itemType' in field && field.itemType ? field.itemType : 'text'
    return `${itemType.toUpperCase()}[]`
  }

  // Handle decimal/currency/percentage with precision
  const numericTypesWithPrecision = ['decimal', 'currency', 'percentage']
  if (numericTypesWithPrecision.includes(field.type) && 'precision' in field && field.precision) {
    return `NUMERIC(${field.precision},2)`
  }

  const postgresType = fieldTypeToPostgresMap[field.type]
  if (!postgresType) {
    // eslint-disable-next-line functional/no-throw-statements -- Error is caught by Effect.try in table-operations.ts
    throw new Error(`Unknown field type: ${field.type}`)
  }

  return postgresType
}
