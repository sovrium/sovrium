/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hasCreatePermission } from '@/application/use-cases/tables/permissions/permissions'
import {
  batchCreateProgram,
  batchUpdateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  upsertProgram,
} from '@/application/use-cases/tables/programs'
import { filterReadableFields } from '@/application/use-cases/tables/utils/field-read-filter'
import {
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  batchRestoreRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/domain/models/api/request'
import {
  batchCreateRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  upsertRecordsResponseSchema,
} from '@/domain/models/api/tables'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { validateReadonlyFields, validateUpsertRequest, applyReadFiltering } from './upsert-helpers'
import { handleBatchRestoreError } from './utils'
import type {
  RecordFieldValue,
  FormattedFieldValue,
  TransformedRecord,
} from '@/application/use-cases/tables/utils/record-transformer'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

/**
 * Check if user is viewer and return 403 response if so
 */
function checkViewerPermission(userRole: string, c: Context): Response | undefined {
  if (userRole === 'viewer') {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
}

/**
 * Apply read-level filtering to batch update response records
 */
function applyBatchUpdateReadFiltering(
  response: { readonly updated: number; readonly records?: readonly TransformedRecord[] },
  params: {
    readonly app: App
    readonly tableName: string
    readonly userRole: string
    readonly userId: string
  }
): { readonly updated: number; readonly records?: readonly TransformedRecord[] } {
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
    updated: response.updated,
    records: filteredRecords,
  }
}

/**
 * Handle batch restore endpoint
 */
async function handleBatchRestore(c: Context, _app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot restore)
  if (userRole === 'viewer') {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to restore records in this table',
      },
      403
    )
  }

  const result = await validateRequest(c, batchRestoreRecordsRequestSchema)
  if (!result.success) return result.response

  try {
    const response = await Effect.runPromise(
      Effect.provide(batchRestoreProgram(session, tableName, result.data.ids), TableLive)
    )
    return c.json(response, 200)
  } catch (error) {
    return handleBatchRestoreError(c, error)
  }
}

/**
 * Handle batch create endpoint
 */
async function handleBatchCreate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, batchCreateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasCreatePermission(table, userRole)) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to create records in this table',
      },
      403
    )
  }

  // Extract fields from nested format (schema transforms to { fields: {...} })
  const allForbiddenFields = result.data.records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)

  if (allForbiddenFields.length > 0) {
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    return c.json(
      {
        success: false,
        message: `You do not have permission to modify field(s): ${uniqueForbiddenFields.join(', ')}`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // Extract flat field objects from nested format for database layer
  const flatRecordsData = result.data.records.map((record) => record.fields)

  return runEffect(
    c,
    Effect.provide(batchCreateProgram(session, tableName, flatRecordsData), TableLive),
    batchCreateRecordsResponseSchema,
    201
  )
}

/**
 * Strip forbidden fields from records based on write permissions
 */
function stripForbiddenFields(
  records: readonly { readonly id: number; readonly fields: Record<string, unknown> }[],
  params: { readonly app: App; readonly tableName: string; readonly userRole: string }
): readonly { readonly id: number; readonly fields: Record<string, unknown> }[] {
  return records.map((record) => {
    const forbiddenFields = validateFieldWritePermissions(
      params.app,
      params.tableName,
      params.userRole,
      record.fields
    )

    const allowedFields = Object.keys(record.fields).reduce<Record<string, unknown>>(
      (acc, fieldName) => {
        if (forbiddenFields.includes(fieldName)) {
          return acc
        }
        return { ...acc, [fieldName]: record.fields[fieldName] }
      },
      {}
    )

    return {
      id: record.id,
      fields: allowedFields,
    }
  })
}

/**
 * Check if all records have no allowed fields and return 403 response if so
 */
function checkAllFieldsForbidden(
  recordsData: readonly { readonly fields: Record<string, unknown> }[],
  originalRecords: readonly { readonly fields: Record<string, unknown> }[],
  params: {
    readonly app: App
    readonly tableName: string
    readonly userRole: string
    readonly c: Context
  }
): Response | undefined {
  const hasAnyAllowedFields = recordsData.some((record) => Object.keys(record.fields).length > 0)

  if (!hasAnyAllowedFields) {
    const allForbiddenFields = originalRecords.flatMap((record) =>
      validateFieldWritePermissions(params.app, params.tableName, params.userRole, record.fields)
    )
    const uniqueForbiddenFields = [...new Set(allForbiddenFields)]
    const firstForbiddenField = uniqueForbiddenFields[0]
    return params.c.json(
      {
        success: false,
        message: `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  return undefined
}

/**
 * Handle batch update endpoint
 */
async function handleBatchUpdate(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  const { hasUpdatePermission } =
    await import('@/application/use-cases/tables/permissions/permissions')
  if (!hasUpdatePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to update records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  const recordsData = stripForbiddenFields(result.data.records, { app, tableName, userRole })

  const forbiddenCheck = checkAllFieldsForbidden(recordsData, result.data.records, {
    app,
    tableName,
    userRole,
    c,
  })
  if (forbiddenCheck) return forbiddenCheck

  const program = batchUpdateProgram(session, tableName, recordsData, result.data.returnRecords)

  const filteredProgram = program.pipe(
    Effect.map((response) =>
      applyBatchUpdateReadFiltering(response, { app, tableName, userRole, userId: session.userId })
    )
  )

  return runEffect(c, Effect.provide(filteredProgram, TableLive), batchUpdateRecordsResponseSchema)
}

/**
 * Handle batch delete endpoint
 */
async function handleBatchDelete(c: Context, _app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName } = getTableContext(c)

  const result = await validateRequest(c, batchDeleteRecordsRequestSchema)
  if (!result.success) return result.response

  // Check for permanent delete query parameter
  const permanent = c.req.query('permanent') === 'true'

  return runEffect(
    c,
    Effect.provide(batchDeleteProgram(session, tableName, result.data.ids, permanent), TableLive),
    batchDeleteRecordsResponseSchema
  )
}

/**
 * Handle upsert endpoint
 */
async function handleUpsert(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot upsert)
  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, upsertRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Validate readonly fields BEFORE permission checks
  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  // Validate permissions and required fields
  const validation = await validateUpsertRequest({
    c,
    app,
    tableName,
    userRole,
    records: result.data.records,
    fieldsToMergeOn: result.data.fieldsToMergeOn,
  })
  if (!validation.success) return validation.response

  // Extract flat field objects for database layer
  const flatRecordsData = validation.strippedRecords.map((record) => record.fields)

  // Execute upsert
  const program = upsertProgram(session, tableName, {
    recordsData: flatRecordsData,
    fieldsToMergeOn: result.data.fieldsToMergeOn,
    returnRecords: result.data.returnRecords,
    app,
  })

  // Apply field-level read filtering to response
  const filteredProgram = await applyReadFiltering({
    program,
    app,
    tableName,
    userRole,
    userId: session.userId,
  })

  return runEffect(c, Effect.provide(filteredProgram, TableLive), upsertRecordsResponseSchema)
}

export function chainBatchRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
      // IMPORTANT: More specific route (batch/restore) must come BEFORE generic batch routes
      .post('/api/tables/:tableId/records/batch/restore', (c) => handleBatchRestore(c, app))
      // Generic batch routes AFTER more specific batch/restore route
      .post('/api/tables/:tableId/records/batch', (c) => handleBatchCreate(c, app))
      .patch('/api/tables/:tableId/records/batch', (c) => handleBatchUpdate(c, app))
      .delete('/api/tables/:tableId/records/batch', (c) => handleBatchDelete(c, app))
      .post('/api/tables/:tableId/records/upsert', (c) => handleUpsert(c, app))
  )
}

/* eslint-enable drizzle/enforce-delete-with-where */
