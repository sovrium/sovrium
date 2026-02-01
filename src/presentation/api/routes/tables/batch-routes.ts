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
import { handleBatchRestoreError } from './utils'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

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
        error: 'Forbidden',
        message: `You do not have permission to modify field(s): ${uniqueForbiddenFields.join(', ')}`,
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
async function handleBatchUpdate(c: Context, _app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName } = getTableContext(c)

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  // Flatten records from { id, fields } to { id, ...fields } for database layer
  const flatRecordsData = result.data.records.map((record) => ({
    id: record.id,
    ...record.fields,
  }))

  return runEffect(
    c,
    batchUpdateProgram(session, tableName, flatRecordsData),
    batchUpdateRecordsResponseSchema
  )
}

/**
 * Handle batch delete endpoint
 */
async function handleBatchDelete(c: Context, _app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName } = getTableContext(c)

  const result = await validateRequest(c, batchDeleteRecordsRequestSchema)
  if (!result.success) return result.response

  return runEffect(
    c,
    batchDeleteProgram(session, tableName, result.data.ids),
    batchDeleteRecordsResponseSchema
  )
}

/**
 * Validate required fields for upsert records
 * Records come from schema in nested format: { fields: {...} }
 */
async function validateUpsertRequiredFields(
  table: NonNullable<App['tables']>[number] | undefined,
  records: readonly { fields: Record<string, unknown> }[]
): Promise<Array<{ record: number; field: string; error: string }>> {
  const { validateRequiredFieldsForRecord } = await import('./create-record-helpers')

  return records.flatMap((record, index) => {
    // Extract fields from nested format
    const missingFields = validateRequiredFieldsForRecord(table, record.fields)
    return missingFields.map((field: string) => ({
      record: index,
      field,
      error: 'Required field is missing',
    }))
  })
}

/**
 * Handle upsert endpoint
 */
async function handleUpsert(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, upsertRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Check if user has create permission (for new records)
  if (!hasCreatePermission(table, userRole)) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to create records in this table',
      },
      403
    )
  }

  // Validate field-level write permissions for all records
  // Extract fields from nested format (schema transforms to { fields: {...} })
  const allForbiddenFields = result.data.records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)

  if (allForbiddenFields.length > 0) {
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    return c.json(
      {
        error: 'Forbidden',
        message: `You do not have permission to modify field(s): ${uniqueForbiddenFields.join(', ')}`,
      },
      403
    )
  }

  // Validate required fields for all records
  const validationErrors = await validateUpsertRequiredFields(table, result.data.records)

  if (validationErrors.length > 0) {
    return c.json(
      {
        success: false,
        message: 'Validation failed: one or more records have invalid data',
        code: 'VALIDATION_ERROR',
        details: validationErrors,
      },
      400
    )
  }

  // Extract flat field objects from nested format for database layer
  const flatRecordsData = result.data.records.map((record) => record.fields)

  return runEffect(
    c,
    upsertProgram(session, tableName, {
      recordsData: flatRecordsData,
      fieldsToMergeOn: result.data.fieldsToMergeOn,
      returnRecords: result.data.returnRecords,
    }),
    upsertRecordsResponseSchema
  )
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
