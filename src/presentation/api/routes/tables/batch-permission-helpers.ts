/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterReadableFields } from '@/application/use-cases/tables/utils/field-read-filter'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import type {
  RecordFieldValue,
  FormattedFieldValue,
  TransformedRecord,
} from '@/application/use-cases/tables/utils/record-transformer'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Check if user is viewer and return 403 response if so
 */
export function checkViewerPermission(
  userRole: string,
  c: Context,
  action: string = 'perform this action'
): Response | undefined {
  if (userRole === 'viewer') {
    return c.json(
      {
        success: false,
        message: `You do not have permission to ${action}`,
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
}

/**
 * Check if request has more than 1000 records and return 413 if so
 */
export function checkRecordLimitExceeded(
  records: readonly unknown[],
  c: Context
): Response | undefined {
  if (records.length > 1000) {
    return c.json(
      {
        success: false,
        message: 'Batch size exceeds maximum of 1000 records',
        code: 'PAYLOAD_TOO_LARGE',
        error: 'PayloadTooLarge',
      },
      413
    )
  }
  return undefined
}

/**
 * Parameters for read-level field filtering
 */
interface ReadFilteringParams {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userId: string
}

/**
 * Apply read-level filtering to batch response records.
 *
 * Generic over the count property key (e.g. 'updated', 'created')
 * to eliminate duplication between batch create and batch update responses.
 */
export function applyBatchReadFiltering<K extends string>(
  response: { readonly [P in K]: number } & { readonly records?: readonly TransformedRecord[] },
  params: ReadFilteringParams,
  countKey: K
): { readonly [P in K]: number } & { readonly records?: readonly TransformedRecord[] } {
  if (!response.records) return response

  const filteredRecords: readonly TransformedRecord[] = response.records.map((record) => ({
    ...record,
    fields: filterReadableFields({
      app: params.app,
      tableName: params.tableName,
      userRole: params.userRole,
      userId: params.userId,
      record: record.fields,
    }) as Record<string, RecordFieldValue | FormattedFieldValue>,
  }))

  return {
    [countKey]: response[countKey],
    records: filteredRecords,
  } as { readonly [P in K]: number } & { readonly records?: readonly TransformedRecord[] }
}

/**
 * Check field-level write permissions for batch records
 */
export function checkBatchFieldPermissions(config: {
  readonly records: readonly { readonly fields: Record<string, unknown> }[]
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}): Response | null {
  const { records, app, tableName, userRole, c } = config
  const allForbiddenFields = records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)

  if (allForbiddenFields.length > 0) {
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    return c.json(
      {
        success: false,
        message: `Cannot write to field '${uniqueForbiddenFields[0]}': insufficient permissions`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // eslint-disable-next-line unicorn/no-null -- null indicates no permission error
  return null
}

/**
 * Validate stripped records have at least some writable fields
 */
export function validateStrippedRecordsNotEmpty(config: {
  readonly strippedRecords: readonly { readonly fields: Record<string, unknown> }[]
  readonly originalRecords: readonly { readonly fields: Record<string, unknown> }[]
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}): Response | null {
  const { strippedRecords, originalRecords, app, tableName, userRole, c } = config
  const hasWritableFields = strippedRecords.some((record) => Object.keys(record.fields).length > 0)
  if (!hasWritableFields) {
    // All fields were stripped - user tried to update only protected fields
    const allForbiddenFields = originalRecords
      .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
      .filter((fields) => fields.length > 0)
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    const firstForbiddenField = uniqueForbiddenFields[0]
    return c.json(
      {
        success: false,
        message: `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // eslint-disable-next-line unicorn/no-null -- null indicates no error
  return null
}
