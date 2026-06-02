/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDatabaseDialectConfig } from '@/domain/models/env/database-dialect'
import type { Fields } from '@/domain/models/app/tables/fields'

export const fieldTypeToPostgresMap: Record<string, string> = {
  'ai-categorize': 'VARCHAR(255)',
  'ai-extract': 'JSONB',
  'ai-generate': 'TEXT',
  'ai-sentiment': 'JSONB',
  'ai-summary': 'TEXT',
  'ai-tag': 'JSONB',
  'ai-translate': 'TEXT',
  integer: 'INTEGER',
  autonumber: 'INTEGER',
  decimal: 'DECIMAL',
  'single-line-text': 'VARCHAR(255)',
  'long-text': 'TEXT',
  email: 'VARCHAR(255)',
  url: 'VARCHAR(255)',
  'phone-number': 'VARCHAR(255)',
  'rich-text': 'TEXT',
  checkbox: 'BOOLEAN',
  boolean: 'BOOLEAN',
  number: 'DECIMAL',
  attachment: 'JSONB',
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
  code: 'TEXT',
}

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


const postgresToSqliteTypeMap: Record<string, string> = {
  TIMESTAMPTZ: 'TEXT',
  TIMESTAMP: 'TEXT',
  DATE: 'TEXT',
  TIME: 'TEXT',
  JSONB: 'TEXT',
  JSON: 'TEXT',
  SERIAL: 'INTEGER',
  BIGSERIAL: 'INTEGER',
  INTERVAL: 'INTEGER',
  BOOLEAN: 'INTEGER',
  POINT: 'TEXT',
  GEOMETRY: 'TEXT',
  GEOGRAPHY: 'TEXT',
  TSVECTOR: 'TEXT',
  VECTOR: 'TEXT',
  UUID: 'TEXT',
}

export const mapPostgresTypeToSqlite = (postgresType: string): string => {
  const upper = postgresType.toUpperCase().trim()

  if (upper.endsWith('[]')) return 'TEXT'
  if (upper.startsWith('VARCHAR') || upper.startsWith('CHAR')) return 'TEXT'
  if (upper.startsWith('NUMERIC') || upper.startsWith('DECIMAL')) return 'NUMERIC'

  return postgresToSqliteTypeMap[upper] ?? upper
}

export const mapFieldTypeToDialect = (field: Fields[number]): string => {
  const postgresType = mapFieldTypeToPostgres(field)
  return parseDatabaseDialectConfig().dialect === 'sqlite'
    ? mapPostgresTypeToSqlite(postgresType)
    : postgresType
}

export const mapFormulaResultTypeToDialect = (resultType: string | undefined): string => {
  const postgresType = mapFormulaResultTypeToPostgres(resultType)
  return parseDatabaseDialectConfig().dialect === 'sqlite'
    ? mapPostgresTypeToSqlite(postgresType)
    : postgresType
}

const NUMERIC_TYPES_WITH_PRECISION = new Set(['decimal', 'currency', 'percentage'])

const NUMERIC_INTEGER_DIGITS = 18

const specialCasePostgresType = (field: Fields[number]): string | undefined => {
  if (field.type === 'array') {
    const itemType = 'itemType' in field && field.itemType ? field.itemType : 'text'
    return `${itemType.toUpperCase()}[]`
  }
  if (
    NUMERIC_TYPES_WITH_PRECISION.has(field.type) &&
    'precision' in field &&
    field.precision !== undefined
  ) {
    return `NUMERIC(${NUMERIC_INTEGER_DIGITS + field.precision},${field.precision})`
  }
  if (
    field.type === 'single-attachment' &&
    'storeMetadata' in field &&
    field.storeMetadata === true
  ) {
    return 'JSONB'
  }
  return undefined
}

export const mapFieldTypeToPostgres = (field: Fields[number]): string => {
  const special = specialCasePostgresType(field)
  if (special !== undefined) return special
  const postgresType = fieldTypeToPostgresMap[field.type]
  if (!postgresType) {
    throw new Error(`Unknown field type: ${field.type}`)
  }
  return postgresType
}
