/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterReadableFields } from './field-read-filter'
import { transformRecords } from './record-transformer'
import type { TransformedRecord, RecordFieldValue, FormattedFieldValue } from './record-transformer'
import type { App } from '@/domain/models/app'

/**
 * Apply field selection to transform records into flat structure
 * When fields parameter is specified, returns records with only selected fields
 * Maintains Airtable-style structure: { id, fields: { ... }, createdAt, updatedAt }
 */
export function applyFieldSelection(
  records: readonly TransformedRecord[],
  fields: string
): readonly TransformedRecord[] {
  const fieldNames = fields.split(',').map((f) => f.trim())

  return records.map((record) => {
    // Build fields object with only requested fields
    const selectedFields = fieldNames.reduce<
      Record<string, RecordFieldValue | FormattedFieldValue>
    >((acc, fieldName) => {
      // Skip system fields (id, createdAt, updatedAt) - they're at root level
      if (fieldName === 'id' || fieldName === 'createdAt' || fieldName === 'updatedAt') {
        return acc
      }

      // Include user field if it exists
      if (record.fields[fieldName] !== undefined) {
        return { ...acc, [fieldName]: record.fields[fieldName] }
      }

      return acc
    }, {})

    // Return record with Airtable structure, only selected fields
    return {
      id: record.id,
      fields: selectedFields,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      // Include authorship metadata if present
      ...(record.createdBy ? { createdBy: record.createdBy } : {}),
      ...(record.updatedBy ? { updatedBy: record.updatedBy } : {}),
      ...(record.deletedBy ? { deletedBy: record.deletedBy } : {}),
    }
  })
}

/**
 * Apply pagination to records and calculate pagination metadata
 */
export function applyPagination(
  records: readonly TransformedRecord[],
  totalRecords: number,
  limit?: number,
  offset?: number
): {
  readonly paginatedRecords: readonly TransformedRecord[]
  readonly pagination: {
    readonly page: number
    readonly limit: number
    readonly offset: number
    readonly total: number
    readonly totalPages: number
    readonly hasNextPage: boolean
    readonly hasPreviousPage: boolean
  }
} {
  const paginationLimit = limit ?? 100
  const paginationOffset = offset ?? 0
  const paginatedRecords = records.slice(paginationOffset, paginationOffset + paginationLimit)

  const totalPages = Math.ceil(totalRecords / paginationLimit)
  const currentPage = Math.floor(paginationOffset / paginationLimit) + 1

  return {
    paginatedRecords,
    pagination: {
      page: currentPage,
      limit: paginationLimit,
      offset: paginationOffset,
      total: totalRecords,
      totalPages,
      hasNextPage: paginationOffset + paginationLimit < totalRecords,
      hasPreviousPage: paginationOffset > 0,
    },
  }
}

/**
 * Process and transform records with filtering and field selection
 */
export function processRecords(config: {
  readonly records: readonly Record<string, unknown>[]
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userId: string
  readonly format?: 'display'
  readonly timezone?: string
  readonly fields?: string
}): readonly TransformedRecord[] {
  const { records, app, tableName, userRole, userId, format, timezone, fields } = config

  // Apply field-level read permissions filtering
  const filteredRecords = records.map((record) =>
    filterReadableFields({ app, tableName, userRole, userId, record })
  )

  const transformedRecords = transformRecords(filteredRecords, {
    format,
    app,
    tableName,
    timezone,
  }) as TransformedRecord[]

  // Apply field selection if specified
  return fields ? applyFieldSelection(transformedRecords, fields) : transformedRecords
}
