/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterReadableFields } from '@/domain/validators/field-read-filter'
import { transformRecords } from './record-transformer'
import type { TransformedRecord, RecordFieldValue, FormattedFieldValue } from './record-transformer'
import type { App } from '@/domain/models/app'

/**
 * The names `?fields=` accepts that are NOT user columns.
 *
 * They live at the ROOT of the response envelope rather than inside `fields`,
 * so a selection may name one but never places it in the selected object.
 *
 * Exported because two layers held two different vocabularies for the same
 * question: this module has always served `id`, `createdAt` AND `updatedAt`,
 * while `validateFieldsParam` allowed only `id` — so `?fields=id,createdAt` was
 * refused with a 400 before reaching the selection that knew exactly how to
 * answer it. One set, imported by both, is what keeps them from drifting apart
 * again.
 */
export const SELECTABLE_SYSTEM_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'createdAt',
  'updatedAt',
])

/**
 * Apply field selection to transform records into flat structure
 * When fields parameter is specified, returns records with only selected fields
 * Maintains Airtable-style structure: { id, fields: { ... }, createdAt, updatedAt }
 *
 * The envelope is carried through UNTOUCHED and only `fields` is rebuilt, which
 * is the whole of the correction here. The previous version reconstructed each
 * record from four named keys, so `createdBy` / `updatedBy` / `deletedBy`
 * silently vanished whenever a selection was supplied — authorship metadata
 * that sits beside `id` at the root and has no business disappearing because
 * the caller narrowed which USER columns it wanted. Spreading also means the
 * next root-level key is preserved by default instead of needing this function
 * edited to keep it.
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
      if (SELECTABLE_SYSTEM_FIELDS.has(fieldName)) {
        return acc
      }

      // Include user field if it exists
      if (record.fields[fieldName] !== undefined) {
        return { ...acc, [fieldName]: record.fields[fieldName] }
      }

      return acc
    }, {})

    return { ...record, fields: selectedFields }
  })
}

/**
 * Page size applied when a request names none.
 *
 * Exported because `page` is translated to an `offset` at the route boundary
 * (`offset = (page - 1) * limit`), which needs the same fallback this function
 * uses. Two independent defaults would make `?page=2` skip a different number of
 * rows than the envelope then reports.
 */
export const DEFAULT_PAGE_SIZE = 10

/** The pagination block of a list response. */
export interface PaginationMeta {
  readonly page: number
  readonly limit: number
  readonly offset: number
  readonly total: number
  readonly totalPages: number
  readonly hasNextPage: boolean
  readonly hasPreviousPage: boolean
}

/**
 * Describe the page a request asked for, WITHOUT cutting it.
 *
 * Split out from {@link applyPagination} because the two halves stopped being
 * inseparable the moment `LIMIT`/`OFFSET` moved into SQL. On that path the
 * engine has already returned exactly one page, and slicing it a second time
 * with the same offset is not a no-op — `page2.slice(4, 8)` over four rows is
 * EMPTY. The failure has the nastiest possible shape: page 1 (offset 0) stays
 * perfect while every later page silently returns nothing.
 *
 * `total` is therefore a parameter rather than something inferred from the
 * array. Under pushdown the array is one window and the count comes from a
 * separate `COUNT(*)` over the same filter.
 */
export function buildPaginationMeta(
  totalRecords: number,
  limit?: number,
  offset?: number
): PaginationMeta {
  const paginationLimit = limit ?? DEFAULT_PAGE_SIZE
  const paginationOffset = offset ?? 0

  return {
    page: Math.floor(paginationOffset / paginationLimit) + 1,
    limit: paginationLimit,
    offset: paginationOffset,
    total: totalRecords,
    totalPages: Math.ceil(totalRecords / paginationLimit),
    hasNextPage: paginationOffset + paginationLimit < totalRecords,
    hasPreviousPage: paginationOffset > 0,
  }
}

/**
 * Apply pagination to records and calculate pagination metadata.
 *
 * The in-memory route: the caller holds every matching row and this cuts the
 * window out of it. Still used wherever the whole result set is genuinely
 * needed in memory — the `groupBy` path, which partitions the FULL array, and
 * the trash listing.
 */
export function applyPagination(
  records: readonly TransformedRecord[],
  totalRecords: number,
  limit?: number,
  offset?: number
): {
  readonly paginatedRecords: readonly TransformedRecord[]
  readonly pagination: PaginationMeta
} {
  const pagination = buildPaginationMeta(totalRecords, limit, offset)

  return {
    paginatedRecords: records.slice(pagination.offset, pagination.offset + pagination.limit),
    pagination,
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
  readonly format?: 'display'
  readonly timezone?: string
  readonly fields?: string
}): readonly TransformedRecord[] {
  const { records, app, tableName, userRole, format, timezone, fields } = config

  // Apply field-level read permissions filtering
  const filteredRecords = records.map((record) =>
    filterReadableFields({ app, tableName, userRole, record })
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
