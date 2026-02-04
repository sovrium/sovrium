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
} from '@/presentation/api/schemas/request-schemas'
import {
  batchCreateRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  upsertRecordsResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
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
        success: false,
        message: 'You do not have permission to restore records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const result = await validateRequest(c, batchRestoreRecordsRequestSchema)
  if (!result.success) return result.response

  try {
    const response = await Effect.runPromise(
      batchRestoreProgram(session, tableName, result.data.ids)
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
    batchCreateProgram(session, tableName, flatRecordsData),
    batchCreateRecordsResponseSchema,
    201
  )
}

/**
 * Handle batch update endpoint
 */
async function handleBatchUpdate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Authorization: Check table-level update permission
  const { hasUpdatePermission } =
    await import('@/application/use-cases/tables/permissions/permissions')
  if (!hasUpdatePermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to update records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // Validate readonly fields BEFORE permission checks
  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  // Authorization: Check field-level write permissions
  const fieldPermissionCheck = await import('./upsert-helpers').then((m) =>
    m.checkFieldPermissions({
      app,
      tableName,
      userRole,
      records: result.data.records,
      c,
    })
  )
  if (!fieldPermissionCheck.allowed) return fieldPermissionCheck.response

  // Keep records in { id, fields } format for database layer
  const recordsData = result.data.records.map((record) => ({
    id: record.id,
    fields: record.fields,
  }))

  // Execute batch update with returnRecords parameter
  const program = batchUpdateProgram(session, tableName, recordsData, result.data.returnRecords)

  // Apply field-level read filtering to response (if records returned)
  const filteredProgram = program.pipe(
    Effect.map((response) =>
      applyBatchUpdateReadFiltering(response, { app, tableName, userRole, userId: session.userId })
    )
  )

  return runEffect(c, filteredProgram, batchUpdateRecordsResponseSchema)
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
    batchDeleteProgram(session, tableName, result.data.ids, permanent),
    batchDeleteRecordsResponseSchema
  )
}

/**
 * Handle upsert endpoint
 */
async function handleUpsert(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot upsert)
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

  return runEffect(c, filteredProgram, upsertRecordsResponseSchema)
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
