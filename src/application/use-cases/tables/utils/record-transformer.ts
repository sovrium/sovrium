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
 * Convert string numbers to numeric values
 */
const parseNumericString = (
  value: unknown,
  processedValue: Readonly<RecordFieldValue>
): Readonly<RecordFieldValue> => {
  if (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value))) {
    return parseFloat(value)
  }
  return processedValue
}

/**
 * Build formatted field value with optional metadata
 */
function buildFormattedValue(
  fieldValue: Readonly<RecordFieldValue>,
  formatResult: Readonly<FormatResult>
): FormattedFieldValue {
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

  // Apply display formatting if requested
  const shouldFormat = options?.format === 'display' && options.app && options.tableName
  if (!shouldFormat) {
    return processedValue
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
  record: Record<string, unknown>,
  options?: {
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }
): TransformedRecord => {
  // Extract system fields
  const { id, created_at: createdAt, updated_at: updatedAt, ...userFields } = record

  // Convert Date objects to ISO strings in user fields and optionally format for display
  const transformedFields = Object.entries(userFields).reduce<
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
