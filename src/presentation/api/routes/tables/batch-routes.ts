/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  hasCreatePermission,
  hasUpdatePermission,
  hasDeletePermission,
} from '@/application/use-cases/tables/permissions/permissions'
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
import { runEffect } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { validateRequest } from '@/presentation/api/utils/validate-request'
import {
  validateReadonlyFields,
  validateUpsertRequest,
  applyReadFiltering,
  stripUnwritableFields,
} from './upsert-helpers'
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
function checkViewerPermission(
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
function checkRecordLimitExceeded(records: readonly unknown[], c: Context): Response | undefined {
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
 * Apply read-level filtering to batch create response records
 */
function applyBatchCreateReadFiltering(
  response: { readonly created: number; readonly records?: readonly TransformedRecord[] },
  params: {
    readonly app: App
    readonly tableName: string
    readonly userRole: string
    readonly userId: string
  }
): { readonly created: number; readonly records?: readonly TransformedRecord[] } {
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
    created: response.created,
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
 * Validate field-level write permissions for batch records
 */
function validateFieldWritePermissions(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): string[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return []

  const roleHierarchy = { viewer: 0, member: 1, editor: 2, admin: 3 }
  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0

  return Object.keys(fields)
    .map((fieldName) => {
      const field = table.fields?.find((f) => f.name === fieldName)
      if (!field) return undefined

      const writePermission = field.write || 'editor'
      const requiredLevel = roleHierarchy[writePermission as keyof typeof roleHierarchy] || 0

      return userLevel < requiredLevel ? fieldName : undefined
    })
    .filter((fieldName): fieldName is string => fieldName !== undefined)
}

/**
 * Check field-level write permissions for batch records
 */
function checkBatchFieldPermissions(config: {
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
 * Handle batch create endpoint
 */
async function handleBatchCreate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot create)
  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  // Check record count before validation to return 413 for payload too large
  const body = await c.req.json()
  const recordLimitCheck = checkRecordLimitExceeded(body.records || [], c)
  if (recordLimitCheck) return recordLimitCheck

  const result = await validateRequest(c, batchCreateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasCreatePermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to create records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // Check field-level permissions
  const fieldPermCheck = checkBatchFieldPermissions({
    records: result.data.records,
    app,
    tableName,
    userRole,
    c,
  })
  if (fieldPermCheck) return fieldPermCheck

  // Validate readonly fields
  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  // Extract flat field objects from records for database layer
  const flatRecordsData = result.data.records.map((record) => record.fields)

  // Execute batch create with returnRecords parameter and app for numeric coercion
  const program = batchCreateProgram({
    session,
    tableName,
    recordsData: flatRecordsData,
    returnRecords: result.data.returnRecords,
    app,
  })

  // Apply field-level read filtering to response (if records returned)
  const filteredProgram = program.pipe(
    Effect.map((response) =>
      applyBatchCreateReadFiltering(response, { app, tableName, userRole, userId: session.userId })
    )
  )

  return runEffect(
    c,
    Effect.provide(filteredProgram, TableLive),
    batchCreateRecordsResponseSchema,
    201
  )
}

/**
 * Validate stripped records have at least some writable fields
 */
function validateStrippedRecordsNotEmpty(config: {
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

/**
 * Handle batch update endpoint
 */
async function handleBatchUpdate(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot update)
  const viewerCheck = checkViewerPermission(userRole, c)
  if (viewerCheck) return viewerCheck

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Authorization: Check table-level update permission
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

  // Validate readonly fields BEFORE permission checks
  const readonlyValidation = validateReadonlyFields(table, result.data.records, c)
  if (readonlyValidation) return readonlyValidation

  // Authorization: Check field-level write permissions and strip unwritable fields
  const strippedRecords = stripUnwritableFields(app, tableName, userRole, result.data.records)

  // Validate at least some writable fields remain after stripping
  const strippedValidation = validateStrippedRecordsNotEmpty({
    strippedRecords,
    originalRecords: result.data.records,
    app,
    tableName,
    userRole,
    c,
  })
  if (strippedValidation) return strippedValidation

  // Keep records in { id, fields } format for database layer
  const recordsData = strippedRecords.map((record) => ({
    id: record.id,
    fields: record.fields,
  }))

  // Execute batch update with returnRecords parameter and app for numeric coercion
  const program = batchUpdateProgram({
    session,
    tableName,
    recordsData,
    returnRecords: result.data.returnRecords,
    app,
  })

  // Apply field-level read filtering to response (if records returned)
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
async function handleBatchDelete(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  // Authorization check BEFORE validation (viewer role cannot delete)
  const viewerCheck = checkViewerPermission(userRole, c, 'delete records in this table')
  if (viewerCheck) return viewerCheck

  // Check payload size before validation
  const body = await c.req.json()
  if (body.ids && body.ids.length > 1000) {
    return c.json({ error: 'PayloadTooLarge' }, 413)
  }

  const result = await validateRequest(c, batchDeleteRecordsRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Authorization: Check table-level delete permission
  if (!hasDeletePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to delete records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

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
  const filteredProgram = applyReadFiltering({
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
