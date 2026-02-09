/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  hasCreatePermission,
  hasDeletePermission,
  hasReadPermission,
} from '@/application/use-cases/tables/permissions/permissions'
import {
  createListRecordsProgram,
  createListTrashProgram,
  createGetRecordProgram,
  createRecordProgram,
  restoreRecordProgram,
  deleteRecordProgram,
  permanentlyDeleteRecordProgram,
} from '@/application/use-cases/tables/programs'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
} from '@/domain/models/api/request-schemas'
import {
  listRecordsResponseSchema,
  getRecordResponseSchema,
  createRecordResponseSchema,
} from '@/domain/models/api/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/validation'
import { handleGetRecordError, handleRestoreRecordError } from './error-handlers'
import { validateFilterParam, validateAggregateParam } from './field-permission-validation'
import { parseFilter } from './list-records-filter'
import { parseListRecordsParams } from './param-parsers'
import {
  checkTableUpdatePermissionWithRole,
  filterAllowedFieldsWithRole,
  handleNoAllowedFields,
  executeUpdate,
} from './record-update-handler'
import { validateSortPermission } from './sort-validation'
import { validateTimezoneParam } from './timezone-validation'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Session type derived from table context to respect layer boundaries */
type SessionContext = ReturnType<typeof getTableContext>['session']

/**
 * Check viewer read permission - viewers have restricted access
 * Returns error response if permission denied, undefined otherwise
 */
function checkViewerReadPermission(
  table: Parameters<typeof hasReadPermission>[0],
  userRole: string,
  c: Context
) {
  if (userRole === 'viewer' && !hasReadPermission(table, userRole)) {
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

export async function handleListRecords(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)

  // Check viewer permission (other roles filtered by RLS at row level)
  const permissionError = checkViewerReadPermission(table, userRole, c)
  if (permissionError) return permissionError

  const filter = parseFilter(c, app, tableName, userRole)
  if (filter.error) {
    return (
      filter.response ??
      c.json(
        { success: false, message: 'Invalid filterByFormula syntax', code: 'VALIDATION_ERROR' },
        400
      )
    )
  }

  const { includeDeleted, format, timezone, sort, fields, limit, offset, aggregate } =
    parseListRecordsParams(c)

  const timezoneError = validateTimezoneParam(timezone, c)
  if (timezoneError) return timezoneError

  const sortError = validateSortPermission({ sort, app, tableName, userRole, c })
  if (sortError) return sortError

  const filterError = validateFilterParam(filter.value, table, userRole, c)
  if (filterError) return filterError

  const aggregateError = validateAggregateParam(aggregate, table, userRole, c)
  if (aggregateError) return aggregateError

  return runEffect(
    c,
    createListRecordsProgram({
      session,
      tableName,
      app,
      userRole,
      filter: filter.value,
      includeDeleted,
      format,
      timezone,
      sort,
      fields,
      limit,
      offset,
      aggregate,
    }),
    listRecordsResponseSchema
  )
}

export async function handleListTrash(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)

  // Check viewer permission (other roles filtered by RLS at row level)
  const permissionError = checkViewerReadPermission(table, userRole, c)
  if (permissionError) return permissionError

  // Parse filter parameter
  const filter = parseFilter(c, app, tableName, userRole)
  if (filter.error) {
    return (
      filter.response ??
      c.json(
        { success: false, message: 'Invalid filterByFormula syntax', code: 'VALIDATION_ERROR' },
        400
      )
    )
  }

  // Parse query parameters (sort, limit, offset)
  const { sort, limit, offset } = parseListRecordsParams(c)

  // Validate sort permission
  const sortError = validateSortPermission({ sort, app, tableName, userRole, c })
  if (sortError) return sortError

  // Validate filter permission
  const filterError = validateFilterParam(filter.value, table, userRole, c)
  if (filterError) return filterError

  return runEffect(
    c,
    createListTrashProgram({
      session,
      tableName,
      app,
      userRole,
      filter: filter.value,
      sort,
      limit,
      offset,
    }),
    listRecordsResponseSchema
  )
}

/**
 * Check create permission for table and user role
 * Returns error response if permission denied, undefined otherwise
 */
function checkCreatePermission(
  table: Parameters<typeof hasCreatePermission>[0],
  userRole: string,
  c: Context
) {
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
  return undefined
}

export async function handleCreateRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, createRecordRequestSchema)
  if (!result.success) return result.response

  const table = app.tables?.find((t) => t.name === tableName)

  // Check table-level create permission
  const permissionError = checkCreatePermission(table, userRole, c)
  if (permissionError) return permissionError

  // Validate fields using Effect-based validation
  const validationLayer = createValidationLayer(app, tableName, userRole)
  const program = validateRecordCreation(result.data.fields).pipe(Effect.provide(validationLayer))

  const validationResult = await Effect.runPromise(program.pipe(Effect.either))

  if (validationResult._tag === 'Left') {
    return formatValidationError(validationResult.left, c)
  }

  return await runEffect(
    c,
    createRecordProgram({ session, tableName, fields: validationResult.right, app, userRole }),
    createRecordResponseSchema,
    201
  )
}

export async function handleGetRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)
  const recordId = c.req.param('recordId')
  const includeDeleted = c.req.query('includeDeleted') === 'true'

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasReadPermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  try {
    return await runEffect(
      c,
      createGetRecordProgram({ session, tableName, app, userRole, recordId, includeDeleted }),
      getRecordResponseSchema
    )
  } catch (error) {
    return handleGetRecordError(c, error)
  }
}

/**
 * Validate readonly fields for update request
 */
function validateUpdateReadonlyFields(fields: Record<string, unknown>, c: Context) {
  const READONLY_FIELDS = new Set(['id', 'created_at', 'updated_at'])
  const attemptedReadonlyFields = Object.keys(fields).filter((field) => READONLY_FIELDS.has(field))

  if (attemptedReadonlyFields.length > 0) {
    const firstReadonlyField = attemptedReadonlyFields[0]!
    return c.json(
      {
        success: false,
        message: `Cannot write to readonly field '${firstReadonlyField}'`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  return undefined
}

/**
 * Validate forbidden fields for update request
 */
function validateUpdateForbiddenFields(
  forbiddenFields: readonly string[],
  c: Context
): Response | undefined {
  const SYSTEM_PROTECTED_FIELDS = new Set(['user_id', 'owner_id'])
  const attemptedForbiddenFields = forbiddenFields.filter(
    (field) => !SYSTEM_PROTECTED_FIELDS.has(field)
  )

  if (attemptedForbiddenFields.length > 0) {
    const firstForbiddenField = attemptedForbiddenFields[0]!
    return c.json(
      {
        success: false,
        message: `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
        code: 'FORBIDDEN',
        field: firstForbiddenField,
      },
      403
    )
  }

  return undefined
}

export async function handleUpdateRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, updateRecordRequestSchema)
  if (!result.success) return result.response

  // Check for readonly fields BEFORE permission checks
  const readonlyValidation = validateUpdateReadonlyFields(result.data.fields, c)
  if (readonlyValidation) return readonlyValidation

  const permissionCheck = checkTableUpdatePermissionWithRole(app, tableName, userRole, c)
  if (!permissionCheck.allowed) {
    return permissionCheck.response
  }

  // Extract fields from nested format
  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    result.data.fields
  )

  // Validate forbidden fields
  const forbiddenValidation = validateUpdateForbiddenFields(forbiddenFields, c)
  if (forbiddenValidation) return forbiddenValidation

  if (Object.keys(allowedData).length === 0) {
    return handleNoAllowedFields({
      session,
      tableName,
      recordId: c.req.param('recordId'),
      forbiddenFields,
      c,
    })
  }

  return executeUpdate({
    session,
    tableName,
    recordId: c.req.param('recordId'),
    allowedData,
    app,
    userRole,
    c,
  })
}

/**
 * Execute permanent delete and return response
 */
async function executePermanentDelete(
  session: SessionContext,
  tableName: string,
  recordId: string,
  c: Context
) {
  const deleteResult = await Effect.runPromise(
    permanentlyDeleteRecordProgram(session, tableName, recordId)
  )

  if (!deleteResult) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

/**
 * Execute soft delete and return response
 */
async function executeSoftDelete({
  session,
  tableName,
  recordId,
  app,
  c,
}: {
  readonly session: SessionContext
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly c: Context
}) {
  const deleteResult = await Effect.runPromise(
    deleteRecordProgram(session, tableName, recordId, app)
  )

  if (!deleteResult) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

export async function handleDeleteRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasDeletePermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to delete records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const recordId = c.req.param('recordId')
  const permanent = c.req.query('permanent') === 'true'

  // Permanent delete requires admin or owner role
  if (permanent) {
    if (userRole !== 'admin' && userRole !== 'owner') {
      return c.json(
        {
          success: false,
          message: 'Only admins and owners can permanently delete records',
          code: 'FORBIDDEN',
        },
        403
      )
    }

    return executePermanentDelete(session, tableName, recordId, c)
  }

  // Regular soft delete
  return executeSoftDelete({ session, tableName, recordId, app, c })
}

export async function handleRestoreRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasDeletePermission(table, userRole)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to restore records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const recordId = c.req.param('recordId')

  try {
    const restoreResult = await Effect.runPromise(
      restoreRecordProgram(session, tableName, recordId)
    )

    if (!restoreResult.success) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    return c.json(restoreResult, 200)
  } catch (error) {
    return handleRestoreRecordError(c, error)
  }
}
