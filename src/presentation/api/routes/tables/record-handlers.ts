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
} from '@/presentation/api/schemas/request-schemas'
import {
  listRecordsResponseSchema,
  getRecordResponseSchema,
  createRecordResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import {
  validateRecordCreation,
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/validation'
import { handleGetRecordError, handleRestoreRecordError } from './error-handlers'
import { parseFilterParameter } from './filter-parser'
import {
  checkTableUpdatePermissionWithRole,
  filterAllowedFieldsWithRole,
  handleNoAllowedFields,
  executeUpdate,
} from './record-update-handler'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Validate timezone string using Intl.DateTimeFormat
 * Returns true if timezone is valid, false otherwise
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // Attempt to create a DateTimeFormat with the timezone
    // This will throw if the timezone is invalid
    // eslint-disable-next-line functional/no-expression-statements -- Required for validation side-effect
    Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

export async function handleListRecords(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain:
  // requireAuth() → validateTable() → enrichUserRole()
  const { session, tableName, userRole } = getTableContext(c)

  const parsedFilterResult = parseFilterParameter({
    filterParam: c.req.query('filter'),
    app,
    tableName,
    userRole,
    c,
  })

  if (!parsedFilterResult.success) {
    return parsedFilterResult.error
  }

  const parsedFilter = parsedFilterResult.filter
  const includeDeleted = c.req.query('includeDeleted') === 'true'
  const format = c.req.query('format') === 'display' ? ('display' as const) : undefined
  const timezone = c.req.query('timezone')

  // Validate timezone if provided
  if (timezone && !isValidTimezone(timezone)) {
    return c.json(
      {
        success: false,
        message: `Invalid timezone: ${timezone}`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  return runEffect(
    c,
    createListRecordsProgram({
      session,
      tableName,
      app,
      userRole,
      filter: parsedFilter,
      includeDeleted,
      format,
      timezone,
    }),
    listRecordsResponseSchema
  )
}

export async function handleListTrash(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  return runEffect(
    c,
    createListTrashProgram({ session, tableName, app, userRole }),
    listRecordsResponseSchema
  )
}

/**
 * Check create permission for table and user role
 * Returns error response if permission denied, undefined otherwise
 */
function checkCreatePermission(table: unknown, userRole: string, c: Context) {
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
      createGetRecordProgram({ session, tableName, app, userRole, recordId }),
      getRecordResponseSchema
    )
  } catch (error) {
    return handleGetRecordError(c, error)
  }
}

export async function handleUpdateRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = getTableContext(c)

  const result = await validateRequest(c, updateRecordRequestSchema)
  if (!result.success) return result.response

  const permissionCheck = checkTableUpdatePermissionWithRole(app, tableName, userRole, c)
  if (!permissionCheck.allowed) {
    return permissionCheck.response
  }

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    result.data
  )

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
    c,
  })
}

/**
 * Execute permanent delete and return response
 */
async function executePermanentDelete(
  session: unknown,
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
  session: unknown
  tableName: string
  recordId: string
  app: App
  c: Context
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
  if (!hasCreatePermission(table, userRole)) {
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
