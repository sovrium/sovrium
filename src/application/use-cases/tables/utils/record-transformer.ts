/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
 * Transformed record structure for API responses (Airtable-style)
 *
 * System fields (id, createdAt, updatedAt) are at root level.
 * User-defined fields are nested under the `fields` property.
 */
export interface TransformedRecord {
  readonly id: string
  readonly fields: Record<string, RecordFieldValue>
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
 * Transform a raw database record into the API response format (Airtable-style)
 *
 * This utility standardizes record transformation across all table endpoints:
 * - Converts id to string
 * - Nests user-defined fields under `fields` property (Airtable-style)
 * - Keeps system fields (id, createdAt, updatedAt) at root level
 * - Normalizes created_at/updated_at to ISO strings (or current timestamp if missing)
 * - Converts Date objects to ISO 8601 strings for API compliance
 *
 * @param record - Raw database record
 * @returns Transformed record for API response
 */
export const transformRecord = (record: Record<string, unknown>): TransformedRecord => {
  // Extract system fields
  const { id, created_at: createdAt, updated_at: updatedAt, ...userFields } = record

  // Convert Date objects to ISO strings and numeric strings to numbers in user fields
  const transformedFields = Object.entries(userFields).reduce<Record<string, RecordFieldValue>>(
    (acc, [key, value]) => {
      // Convert Date objects to ISO 8601 strings
      if (value instanceof Date) {
        return { ...acc, [key]: value.toISOString() }
      }

      // Convert numeric strings (from PostgreSQL decimal/numeric columns) to numbers
      // Only convert if the string is a valid number representation
      if (typeof value === 'string' && value.trim() !== '') {
        const numValue = Number(value)
        if (!Number.isNaN(numValue) && /^-?\d+(\.\d+)?$/.test(value.trim())) {
          return { ...acc, [key]: numValue }
        }
      }

      return { ...acc, [key]: value as RecordFieldValue }
    },
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
 * @returns Array of transformed records (mutable for API response compatibility)
 */
export const transformRecords = (
  records: readonly Record<string, unknown>[]
): readonly TransformedRecord[] => records.map(transformRecord)
