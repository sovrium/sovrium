/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatFieldForDisplay, type FormatResult } from './display-formatter'
import type { App } from '@/domain/models/app'

/**
 * Field value types supported by record transformation
 */
export type RecordFieldValue =
  | string
  | number
  | boolean
  | unknown[]
  | Record<string, unknown>
  | null

/**
 * Formatted field value with optional display formatting
 */
export interface FormattedFieldValue {
  readonly value: RecordFieldValue
  readonly displayValue?: string
  readonly timezone?: string
  readonly displayTimezone?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFileSizeDisplay?: string
}

/**
 * Transformed record structure for API responses (Airtable-style)
 *
 * System fields (id, createdAt, updatedAt) are at root level.
 * User-defined fields are nested under the `fields` property.
 */
export interface TransformedRecord {
  readonly id: string
  readonly fields: Record<string, RecordFieldValue | FormattedFieldValue>
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Convert a value to ISO 8601 datetime string
 *
 * @param value - Value to convert (Date object or string)
 * @returns ISO 8601 datetime string
 */
const toISOString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return new Date().toISOString()
}

/**
 * Numeric field types that should return number values in API responses.
 * PostgreSQL DECIMAL/NUMERIC types are returned as strings by database drivers,
 * so we coerce them to numbers based on the field's schema type.
 */
const NUMERIC_FIELD_TYPES: ReadonlySet<string> = new Set([
  'currency',
  'number',
  'integer',
  'decimal',
  'percentage',
  'percent',
  'rating',
  'duration',
])

/**
 * Look up a field's type from the app schema
 */
const getFieldType = (
  app: Readonly<App>,
  tableName: string,
  fieldName: string
): string | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.fields.find((f) => f.name === fieldName)?.type
}

/**
 * Coerce a string value to a number if the field type is numeric.
 * Returns the original value unchanged for non-numeric field types.
 */
/* eslint-disable functional/prefer-immutable-types -- RecordFieldValue must be mutable to match FormattedFieldValue interface */
const coerceNumericField = (
  fieldName: string,
  value: RecordFieldValue,
  app: Readonly<App>,
  tableName: string
): RecordFieldValue => {
  /* eslint-enable functional/prefer-immutable-types */
  if (typeof value !== 'string') return value
  const fieldType = getFieldType(app, tableName, fieldName)
  if (!fieldType || !NUMERIC_FIELD_TYPES.has(fieldType)) return value
  const num = Number(value)
  return !isNaN(num) && isFinite(num) ? num : value
}

/**
 * Convert string numbers to numeric values (used in display format path)
 */
// eslint-disable-next-line functional/prefer-immutable-types -- RecordFieldValue must be mutable to match FormattedFieldValue interface
const parseNumericString = (value: unknown, processedValue: RecordFieldValue): RecordFieldValue => {
  // Coerce string numbers to numeric values for numeric field types
  if (typeof value === 'string') {
    const num = Number(value)
    return !isNaN(num) && isFinite(num) ? num : processedValue
  }
  return typeof value === 'number' ? value : processedValue
}

/**
 * Build formatted field value with optional metadata
 */
/* eslint-disable functional/prefer-immutable-types -- RecordFieldValue must be mutable to match FormattedFieldValue interface */
function buildFormattedValue(
  fieldValue: RecordFieldValue,
  formatResult: Readonly<FormatResult>
): FormattedFieldValue {
  /* eslint-enable functional/prefer-immutable-types */
  const base: FormattedFieldValue = {
    value: fieldValue,
    displayValue: formatResult.displayValue,
  }

  return {
    ...base,
    ...(formatResult.timezone ? { timezone: formatResult.timezone } : {}),
    ...(formatResult.displayTimezone ? { displayTimezone: formatResult.displayTimezone } : {}),
    ...(formatResult.allowedFileTypes ? { allowedFileTypes: formatResult.allowedFileTypes } : {}),
    ...(formatResult.maxFileSize !== undefined ? { maxFileSize: formatResult.maxFileSize } : {}),
    ...(formatResult.maxFileSizeDisplay
      ? { maxFileSizeDisplay: formatResult.maxFileSizeDisplay }
      : {}),
  }
}

/**
 * Process a single field value with optional display formatting
 */
const processFieldValue = (
  key: string,
  value: unknown,
  options?: Readonly<{
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }>
): Readonly<RecordFieldValue | FormattedFieldValue> => {
  const processedValue = value instanceof Date ? value.toISOString() : (value as RecordFieldValue)

  // Check if app schema info is available for type-aware processing
  const hasSchemaInfo = options?.app && options?.tableName

  // Apply display formatting if requested
  if (options?.format !== 'display' || !hasSchemaInfo) {
    // Coerce numeric field types to numbers when schema info is available
    return hasSchemaInfo
      ? coerceNumericField(key, processedValue, options.app!, options.tableName!)
      : processedValue
  }

  // For display formatting, pass the original value (may be string or number from database)
  const formatResult = formatFieldForDisplay({
    fieldName: key,
    value,
    app: options.app!,
    tableName: options.tableName!,
    timezoneOverride: options.timezone,
  })

  if (formatResult === undefined) {
    return processedValue
  }

  // For formatted fields, use the original value (preserve number type)
  const fieldValue = parseNumericString(value, processedValue)

  return buildFormattedValue(fieldValue, formatResult)
}

/**
 * Check if a field is defined in the table schema
 */
const isTableField = (
  fieldName: string,
  app: Readonly<App> | undefined,
  tableName: string | undefined
): boolean => {
  if (!app || !tableName) return false
  const table = app.tables?.find((t) => t.name === tableName)
  return Boolean(table?.fields.some((f) => f.name === fieldName))
}

/**
 * Build fields object including created_at/updated_at if they're defined as table fields
 */
const buildFieldsObject = (
  userFields: Readonly<Record<string, unknown>>,
  createdAt: unknown,
  updatedAt: unknown,
  options?: {
    readonly app?: App
    readonly tableName?: string
  }
): Readonly<Record<string, unknown>> => {
  const hasCreatedAtField = isTableField('created_at', options?.app, options?.tableName)
  const hasUpdatedAtField = isTableField('updated_at', options?.app, options?.tableName)

  return {
    ...userFields,
    ...(hasCreatedAtField && createdAt !== undefined ? { created_at: createdAt } : {}),
    ...(hasUpdatedAtField && updatedAt !== undefined ? { updated_at: updatedAt } : {}),
  }
}

/**
 * Transform a raw database record into the API response format (Airtable-style)
 *
 * This utility standardizes record transformation across all table endpoints:
 * - Converts id to string
 * - Nests user-defined fields under `fields` property (Airtable-style)
 * - Keeps system fields (id, createdAt, updatedAt) at root level
 * - Normalizes created_at/updated_at to ISO strings (or current timestamp if missing)
 * - Converts Date objects in field values to ISO 8601 strings for API compliance
 * - Optionally applies display formatting when format=display is requested
 *
 * @param record - Raw database record
 * @param options - Transformation options
 * @returns Transformed record for API response
 */
export const transformRecord = (
  record: Readonly<Record<string, unknown>>,
  options?: {
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }
): TransformedRecord => {
  // Extract system fields
  const { id, created_at: createdAt, updated_at: updatedAt, ...userFields } = record

  // Build user fields, potentially including created_at/updated_at if they're table fields
  const fieldsToTransform = buildFieldsObject(userFields, createdAt, updatedAt, options)

  // Convert Date objects to ISO strings in user fields and optionally format for display
  const transformedFields = Object.entries(fieldsToTransform).reduce<
    Record<string, RecordFieldValue | FormattedFieldValue>
  >(
    (acc, [key, value]) => ({
      ...acc,
      [key]: processFieldValue(key, value, options) as RecordFieldValue | FormattedFieldValue,
    }),
    {}
  )

  return {
    id: String(id),
    fields: transformedFields,
    createdAt: createdAt ? toISOString(createdAt) : new Date().toISOString(),
    updatedAt: updatedAt ? toISOString(updatedAt) : new Date().toISOString(),
  }
}

/**
 * Transform multiple database records into API response format
 *
 * @param records - Array of raw database records
 * @param options - Transformation options
 * @returns Array of transformed records (mutable for API response compatibility)
 */
export const transformRecords = (
  records: readonly Record<string, unknown>[],
  options?: {
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }
): readonly TransformedRecord[] => records.map((record) => transformRecord(record, options))
