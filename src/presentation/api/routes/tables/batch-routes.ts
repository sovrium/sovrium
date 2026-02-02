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
 * Check if any records exist in database based on merge fields
 */
async function checkForExistingRecords(
  tableName: string,
  records: readonly { fields: Record<string, unknown> }[],
  fieldsToMergeOn: readonly string[]
): Promise<boolean> {
  const { db } = await import('@/infrastructure/database/drizzle')
  const { sql } = await import('drizzle-orm')

  // Build WHERE clause - skip records missing merge fields (will fail validation)
  const mergeConditions = records
    .filter((record) =>
      fieldsToMergeOn.every((fieldName) => record.fields[fieldName] !== undefined)
    )
    .map((record) => {
      const conditions = fieldsToMergeOn.map((fieldName) => {
        const value = record.fields[fieldName]
        return sql`${sql.identifier(fieldName)} = ${value}`
      })
      return conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=0`
    })

  // If no valid records to check, return false
  if (mergeConditions.length === 0) return false

  const whereClause = sql.join(mergeConditions, sql` OR `)
  const existingRecords = (await db.execute(
    sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)} WHERE ${whereClause}`
  )) as readonly Record<string, unknown>[]

  const firstRecord = existingRecords[0]
  return firstRecord !== undefined && Number(firstRecord.count) > 0
}

/**
 * Validate field-level write permissions for records
 */
function checkFieldPermissions(config: {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly c: Context
}): { allowed: true } | { allowed: false; response: Response } {
  const { app, tableName, userRole, records, c } = config

  const allForbiddenFields = records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)

  if (allForbiddenFields.length > 0) {
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    const firstForbiddenField = uniqueForbiddenFields[0]
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: `You do not have permission to write to field: ${firstForbiddenField}`,
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  return { allowed: true }
}

/**
 * Check upsert permissions including update permission check
 * This function determines if records will be created or updated, then checks appropriate permissions
 */
async function checkUpsertPermissionsWithUpdateCheck(config: {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly fieldsToMergeOn: readonly string[]
  readonly c: Context
}): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const { app, tableName, userRole, records, fieldsToMergeOn, c } = config
  const table = app.tables?.find((t) => t.name === tableName)

  const { hasUpdatePermission } =
    await import('@/application/use-cases/tables/permissions/permissions')

  // Check if any records will be updated
  const hasExistingRecords = await checkForExistingRecords(tableName, records, fieldsToMergeOn)

  // If records will be updated, check update permission
  if (hasExistingRecords && !hasUpdatePermission(table, userRole)) {
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: 'You do not have permission to update records in this table',
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  // Check table-level create permission (for new records)
  if (!hasCreatePermission(table, userRole)) {
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: 'You do not have permission to create records in this table',
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  // Check field-level write permissions
  return checkFieldPermissions({ app, tableName, userRole, records, c })
}

/**
 * Check if a field type is readonly (cannot be set by users)
 */
function isReadonlyFieldType(fieldType: string): boolean {
  const readonlyTypes = new Set(['created-at', 'updated-at', 'auto-number'])
  return readonlyTypes.has(fieldType)
}

/**
 * Validate that no readonly fields are being set
 * Returns error response if readonly fields detected, undefined otherwise
 */
function validateReadonlyFields(
  table:
    | {
        readonly fields: ReadonlyArray<{
          readonly name: string
          readonly type: string
        }>
      }
    | undefined,
  records: readonly { fields: Record<string, unknown> }[],
  c: Context
) {
  // Check for 'id' field (always readonly)
  const recordWithId = records.find((record) => 'id' in record.fields)
  if (recordWithId) {
    return c.json(
      {
        success: false,
        message: 'Cannot set readonly field: id',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // Check for readonly field types (created-at, updated-at, auto-number)
  if (table) {
    const readonlyFieldNames = new Set(
      table.fields.filter((field) => isReadonlyFieldType(field.type)).map((field) => field.name)
    )

    const attemptedReadonlyField = records
      .flatMap((record) => Object.keys(record.fields))
      .find((fieldName) => readonlyFieldNames.has(fieldName))

    if (attemptedReadonlyField) {
      return c.json(
        {
          success: false,
          message: `Cannot set readonly field: ${attemptedReadonlyField}`,
          code: 'FORBIDDEN',
        },
        403
      )
    }
  }

  return undefined
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

  // Check permissions
  const permissionCheck = await checkUpsertPermissionsWithUpdateCheck({
    app,
    tableName,
    userRole,
    records: result.data.records,
    fieldsToMergeOn: result.data.fieldsToMergeOn,
    c,
  })
  if (permissionCheck.allowed === false) return permissionCheck.response

  // Validate required fields
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

  // Extract flat field objects for database layer
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
