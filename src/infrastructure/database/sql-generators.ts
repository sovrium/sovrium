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
  'single-attachment': 'TEXT',
  'multiple-attachments': 'JSONB',
  relationship: 'TEXT',
  lookup: 'TEXT',
  rollup: 'TEXT',
  formula: 'TEXT',
  user: 'TEXT',
  'created-by': 'INTEGER',
  'updated-by': 'INTEGER',
  'created-at': 'TIMESTAMPTZ',
  'updated-at': 'TIMESTAMPTZ',
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
  date: 'DATE',
  datetime: 'TIMESTAMPTZ',
  timestamp: 'TIMESTAMPTZ',
}

const mapFormulaResultTypeToPostgres = (resultType: string | undefined): string => {
  if (!resultType) return 'TEXT'
  return formulaResultTypeMap[resultType.toLowerCase()] ?? 'TEXT'
}

/**
 * Map field type to PostgreSQL column type
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
 * Check if field is a user reference field (created-by, updated-by)
 * Exported for use in schema-initializer
 */
export const isUserReferenceField = (field: Fields[number]): boolean =>
  field.type === 'created-by' || field.type === 'updated-by'

/**
 * Check if field is an auto-timestamp field (created-at, updated-at)
 */
const isAutoTimestampField = (field: Fields[number]): boolean =>
  field.type === 'created-at' || field.type === 'updated-at'

/**
 * Generate NOT NULL constraint
 */
const generateNotNullConstraint = (field: Fields[number], isPrimaryKey: boolean): string => {
  // Auto-managed fields are always NOT NULL (created-at, updated-at, created-by, updated-by)
  if (isAutoTimestampField(field) || isUserReferenceField(field)) {
    return ' NOT NULL'
  }
  return isPrimaryKey || ('required' in field && field.required) ? ' NOT NULL' : ''
}

/**
 * Format array default value as PostgreSQL ARRAY literal
 */
const formatArrayDefault = (defaultValue: readonly unknown[]): string => {
  const arrayValues = defaultValue.map((val) => `'${escapeSQLString(String(val))}'`).join(', ')
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
  // Auto-timestamp fields get NOW() default (PostgreSQL function for current timestamp)
  if (isAutoTimestampField(field)) {
    return ' DEFAULT NOW()'
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

  // Formula fields: create GENERATED ALWAYS AS column
  if (field.type === 'formula' && 'formula' in field && field.formula) {
    const resultType =
      'resultType' in field && field.resultType
        ? mapFormulaResultTypeToPostgres(field.resultType)
        : 'TEXT'
    return `${field.name} ${resultType} GENERATED ALWAYS AS (${field.formula}) STORED`
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
      (
        field
      ): field is Fields[number] & { type: 'integer' | 'decimal' | 'currency' | 'percentage' } =>
        (field.type === 'integer' ||
          field.type === 'decimal' ||
          field.type === 'currency' ||
          field.type === 'percentage') &&
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
 * Generate CHECK constraints for progress fields (automatic 0-100 range)
 */
const generateProgressConstraints = (fields: readonly Fields[number][]): readonly string[] =>
  fields
    .filter((field): field is Fields[number] & { type: 'progress' } => field.type === 'progress')
    .map((field) => {
      const constraintName = `check_${field.name}_range`
      return `CONSTRAINT ${constraintName} CHECK (${field.name} >= 0 AND ${field.name} <= 100)`
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
 * Generate FOREIGN KEY constraints for user reference fields (created-by, updated-by)
 */
const generateForeignKeyConstraints = (
  _tableName: string,
  _fields: readonly Fields[number][]
): readonly string[] =>
  // TODO: Re-enable foreign keys for created-by/updated-by fields
  // Currently disabled due to PostgreSQL transaction visibility issue
  // See: https://github.com/sovrium/sovrium/issues/3980
  []
// _fields
//   .filter(isUserReferenceField)
//   .map((field) => {
//     const constraintName = `${_tableName}_${field.name}_fkey`
//     return `CONSTRAINT ${constraintName} FOREIGN KEY (${field.name}) REFERENCES public.users(id)`
//   })

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
 * Generate table constraints (CHECK constraints, UNIQUE constraints, FOREIGN KEY, primary key, etc.)
 */
export const generateTableConstraints = (table: Table): readonly string[] => [
  ...generateArrayConstraints(table.fields),
  ...generateNumericConstraints(table.fields),
  ...generateProgressConstraints(table.fields),
  ...generateEnumConstraints(table.fields),
  ...generateUniqueConstraints(table.name, table.fields),
  ...generateForeignKeyConstraints(table.name, table.fields),
  ...generatePrimaryKeyConstraint(table),
]
