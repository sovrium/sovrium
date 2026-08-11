/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterReadableFields } from '@/application/use-cases/tables/utils/field-read-filter'
import { payloadTooLarge } from '@/presentation/api/utils/auth-helpers'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import type {
  RecordFieldValue,
  FormattedFieldValue,
  TransformedRecord,
} from '@/application/use-cases/tables/utils/record-transformer'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Check if user is viewer and return 404 response if so (S1 anti-enumeration —
 * viewer-role denial is uniform across batch endpoints so the write boundary
 * is not discoverable). The `action` parameter is retained for call-site
 * readability but never emitted in the response.
 */
export function checkViewerPermission(
  userRole: string,
  c: Context,
  _action: string = 'perform this action'
): Response | undefined {
  if (userRole === 'viewer') {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
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
    return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
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

  // S1 anti-enumeration: field-permission denial returns 404; field names dropped.
  if (allForbiddenFields.length > 0) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
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
  const { strippedRecords, c } = config
  const hasWritableFields = strippedRecords.some((record) => Object.keys(record.fields).length > 0)
  // S1 anti-enumeration: stripped-all-fields means user tried to write only
  // protected fields — return 404 so the field-permission boundary is not
  // discoverable. Field names are dropped from the response envelope, so we
  // don't need `originalRecords`/`app`/`tableName`/`userRole` to enumerate
  // the offending fields — those config keys are kept on the type to keep
  // call-site signatures stable but are no longer destructured.
  if (!hasWritableFields) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // eslint-disable-next-line unicorn/no-null -- null indicates no error
  return null
}
