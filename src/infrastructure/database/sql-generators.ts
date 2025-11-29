/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Field type to PostgreSQL type mapping
 * Note: button field type is included for type safety but should not create database columns
 */
const fieldTypeToPostgresMap: Record<string, string> = {
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
  date: 'TIMESTAMP',
  datetime: 'TIMESTAMP',
  time: 'TIME',
  'single-select': 'VARCHAR(255)',
  status: 'VARCHAR(255)',
  'multi-select': 'TEXT[]',
  currency: 'DECIMAL',
  percentage: 'DECIMAL',
  rating: 'INTEGER',
  duration: 'INTEGER',
  color: 'VARCHAR(7)',
  progress: 'DECIMAL',
  json: 'JSONB',
  geolocation: 'POINT',
  barcode: 'VARCHAR(255)',
  'single-attachment': 'TEXT',
  'multiple-attachments': 'TEXT',
  relationship: 'TEXT',
  lookup: 'TEXT',
  rollup: 'TEXT',
  formula: 'TEXT',
  user: 'TEXT',
  'created-by': 'TEXT',
  'updated-by': 'TEXT',
  'created-at': 'TIMESTAMP',
  'updated-at': 'TIMESTAMP',
  button: 'TEXT',
}

/**
 * Map field type to PostgreSQL column type
 */
export const mapFieldTypeToPostgres = (field: Fields[number]): string => {
  if (field.type === 'array') {
    const itemType = 'itemType' in field && field.itemType ? field.itemType : 'text'
    return `${itemType.toUpperCase()}[]`
  }

  // Handle decimal with precision
  if (field.type === 'decimal' && 'precision' in field && field.precision) {
    return `NUMERIC(${field.precision},2)`
  }

  return fieldTypeToPostgresMap[field.type] ?? 'TEXT'
}

/**
 * Format default value for SQL
 */
const formatDefaultValue = (defaultValue: unknown): string =>
  typeof defaultValue === 'boolean' ? String(defaultValue) : `'${defaultValue}'`

/**
 * Generate SERIAL column definition for auto-increment fields
 */
const generateSerialColumn = (fieldName: string): string => `${fieldName} SERIAL NOT NULL`

/**
 * Check if field should use SERIAL type
 */
const shouldUseSerial = (field: Fields[number], isPrimaryKey: boolean): boolean =>
  field.type === 'autonumber' || (field.type === 'integer' && isPrimaryKey)

/**
 * Generate NOT NULL constraint
 */
const generateNotNullConstraint = (field: Fields[number], isPrimaryKey: boolean): string =>
  isPrimaryKey || ('required' in field && field.required) ? ' NOT NULL' : ''

/**
 * Generate DEFAULT clause
 */
const generateDefaultClause = (field: Fields[number]): string => {
  // Auto-timestamp fields get CURRENT_TIMESTAMP default
  if (field.type === 'created-at' || field.type === 'updated-at') {
    return ' DEFAULT CURRENT_TIMESTAMP'
  }

  // Explicit default values
  return 'default' in field && field.default !== undefined
    ? ` DEFAULT ${formatDefaultValue(field.default)}`
    : ''
}

/**
 * Generate column definition with constraints
 *
 * NOTE: UNIQUE constraints are NOT generated inline. Named UNIQUE constraints
 * are generated at the table level via generateUniqueConstraints() to ensure
 * they appear in information_schema.table_constraints with queryable constraint names.
 */
export const generateColumnDefinition = (field: Fields[number], isPrimaryKey: boolean): string => {
  // SERIAL columns for auto-increment fields
  if (shouldUseSerial(field, isPrimaryKey)) {
    return generateSerialColumn(field.name)
  }

  const columnType = mapFieldTypeToPostgres(field)
  const notNull = generateNotNullConstraint(field, isPrimaryKey)
  const defaultValue = generateDefaultClause(field)
  return `${field.name} ${columnType}${notNull}${defaultValue}`
}

/**
 * Generate CHECK constraints for array fields with maxItems
 */
const generateArrayConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'array'; maxItems: number } =>
        field.type === 'array' && 'maxItems' in field && typeof field.maxItems === 'number'
    )
    .map(
      (field) =>
        `CONSTRAINT check_${field.name}_max_items CHECK (array_length(${field.name}, 1) IS NULL OR array_length(${field.name}, 1) <= ${field.maxItems})`
    )

/**
 * Generate CHECK constraints for numeric fields with min/max values
 */
const generateNumericConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'integer' | 'decimal' } =>
        (field.type === 'integer' || field.type === 'decimal') &&
        (('min' in field && typeof field.min === 'number') ||
          ('max' in field && typeof field.max === 'number'))
    )
    .map((field) => {
      const hasMin = 'min' in field && typeof field.min === 'number'
      const hasMax = 'max' in field && typeof field.max === 'number'

      const conditions = [
        ...(hasMin ? [`${field.name} >= ${field.min}`] : []),
        ...(hasMax ? [`${field.name} <= ${field.max}`] : []),
      ]

      const constraintName = `check_${field.name}_range`
      const constraintCondition = conditions.join(' AND ')
      return `CONSTRAINT ${constraintName} CHECK (${constraintCondition})`
    })

/**
 * Escape single quotes in SQL string literals to prevent SQL injection
 * PostgreSQL escapes single quotes by doubling them: ' becomes ''
 */
const escapeSQLString = (value: string): string => value.replace(/'/g, "''")

/**
 * Generate CHECK constraints for single-select fields with enum options
 *
 * SECURITY NOTE: Enum options come from validated Effect Schema (SingleSelectFieldSchema).
 * While options are constrained to be strings, we still escape single quotes
 * to prevent SQL injection in case malicious data bypasses schema validation.
 * This follows defense-in-depth security principles.
 */
const generateEnumConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { type: 'single-select'; options: readonly string[] } =>
        field.type === 'single-select' && 'options' in field && Array.isArray(field.options)
    )
    .map((field) => {
      const values = field.options.map((opt) => `'${escapeSQLString(opt)}'`).join(', ')
      const constraintName = `check_${field.name}_enum`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} IN (${values}))`
    })

/**
 * Generate UNIQUE constraints for fields with unique property
 */
export const generateUniqueConstraints = (
  tableName: string,
  fields: readonly Fields[number][]
): readonly string[] =>
  fields
    .filter(
      (field): field is Fields[number] & { unique: true } => 'unique' in field && !!field.unique
    )
    .map((field) => `CONSTRAINT ${tableName}_${field.name}_unique UNIQUE (${field.name})`)

/**
 * Generate primary key constraint if defined
 */
const generatePrimaryKeyConstraint = (table: Table): readonly string[] => {
  if (table.primaryKey?.type === 'composite' && table.primaryKey.fields) {
    return [`PRIMARY KEY (${table.primaryKey.fields.join(', ')})`]
  }
  return []
}

/**
 * Generate table constraints (CHECK constraints, UNIQUE constraints, primary key, etc.)
 */
export const generateTableConstraints = (table: Table): readonly string[] => [
  ...generateArrayConstraints(table.fields),
  ...generateNumericConstraints(table.fields),
  ...generateEnumConstraints(table.fields),
  ...generateUniqueConstraints(table.name, table.fields),
  ...generatePrimaryKeyConstraint(table),
]
