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
} from '@/application/use-cases/tables/permissions/permissions'
import {
  createListRecordsProgram,
  createGetRecordProgram,
  createRecordProgram,
  restoreRecordProgram,
  deleteRecordProgram,
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
import { handleGetRecordError, handleRestoreRecordError } from './error-handlers'
import { parseFilterParameter } from './filter-parser'
import {
  checkTableUpdatePermissionWithRole,
  filterAllowedFieldsWithRole,
  handleNoAllowedFields,
  executeUpdate,
} from './record-update-handler'
import type { App } from '@/domain/models/app'
import type { ContextWithTableAndRole } from '@/presentation/api/middleware/table'
import type { Context } from 'hono'

export async function handleListRecords(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain:
  // requireAuth() → validateTable() → enrichUserRole()
  const { session, tableName, userRole } = (c as ContextWithTableAndRole).var

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

  return runEffect(
    c,
    createListRecordsProgram({ session, tableName, app, userRole, filter: parsedFilter }),
    listRecordsResponseSchema
  )
}

export async function handleCreateRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = (c as ContextWithTableAndRole).var

  const result = await validateRequest(c, createRecordRequestSchema)
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

  return runEffect(
    c,
    createRecordProgram(session, tableName, result.data.fields),
    createRecordResponseSchema,
    201
  )
}

export async function handleGetRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = (c as ContextWithTableAndRole).var
  const recordId = c.req.param('recordId')

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
  const { session, tableName, userRole } = (c as ContextWithTableAndRole).var

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

export async function handleDeleteRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = (c as ContextWithTableAndRole).var

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasDeletePermission(table, userRole)) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to delete records in this table',
      },
      403
    )
  }

  const recordId = c.req.param('recordId')
  const deleteResult = await Effect.runPromise(deleteRecordProgram(session, tableName, recordId))

  if (!deleteResult) {
    return c.json({ error: 'Record not found' }, 404)
  }

  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

export async function handleRestoreRecord(c: Context, app: App) {
  // Session, tableName, and userRole are guaranteed by middleware chain
  const { session, tableName, userRole } = (c as ContextWithTableAndRole).var

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasCreatePermission(table, userRole)) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to restore records in this table',
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
      return c.json({ error: 'Record not found' }, 404)
    }

    return c.json(restoreResult, 200)
  } catch (error) {
    return handleRestoreRecordError(c, error)
  }
}
