/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterReadableFields } from './field-read-filter'
import { transformRecords } from './record-transformer'
import type { TransformedRecord, RecordFieldValue, FormattedFieldValue } from './record-transformer'
import type { App } from '@/domain/models/app'

export function applyFieldSelection(
  records: readonly TransformedRecord[],
  fields: string
): readonly TransformedRecord[] {
  const fieldNames = fields.split(',').map((f) => f.trim())

  return records.map((record) => {
    const selectedFields = fieldNames.reduce<
      Record<string, RecordFieldValue | FormattedFieldValue>
    >((acc, fieldName) => {
      if (fieldName === 'id' || fieldName === 'createdAt' || fieldName === 'updatedAt') {
        return acc
      }

      if (record.fields[fieldName] !== undefined) {
        return { ...acc, [fieldName]: record.fields[fieldName] }
      }

      return acc
    }, {})

    return {
      id: record.id,
      fields: selectedFields,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  })
}

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
  const paginationLimit = limit ?? 10
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

export function processRecords(config: {
  readonly records: readonly Record<string, unknown>[]
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly format?: 'display'
  readonly timezone?: string
  readonly fields?: string
}): readonly TransformedRecord[] {
  const { records, app, tableName, userRole, format, timezone, fields } = config

  const filteredRecords = records.map((record) =>
    filterReadableFields({ app, tableName, userRole, record })
  )

  const transformedRecords = transformRecords(filteredRecords, {
    format,
    app,
    tableName,
    timezone,
  }) as TransformedRecord[]

  return fields ? applyFieldSelection(transformedRecords, fields) : transformedRecords
}
