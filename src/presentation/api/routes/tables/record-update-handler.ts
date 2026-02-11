/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hasUpdatePermission } from '@/application/use-cases/tables/permissions/permissions'
import { updateRecordProgram, rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { transformRecord } from '@/application/use-cases/tables/utils/record-transformer'
import { TableLive } from '@/infrastructure/database/table-live-layers'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { handleGetRecordError, handleInternalError } from './error-handlers'
import { isAuthorizationError, type Session } from './utils'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])

/**
 * Check if user has table-level update permission (using pre-fetched role from middleware)
 */
export function checkTableUpdatePermissionWithRole(
  app: App,
  tableName: string,
  userRole: string,
  c: Context
): { allowed: true } | { allowed: false; response: Response } {
  const table = app.tables?.find((t) => t.name === tableName)

  if (!hasUpdatePermission(table, userRole, app.tables)) {
    // Viewer-specific message for default permission denial
    const message =
      userRole === 'viewer'
        ? 'You do not have permission to perform this action'
        : 'You do not have permission to update records in this table'

    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message,
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  return { allowed: true }
}

/**
 * Filter update data to only include fields user has permission to modify (using pre-fetched role from middleware)
 */
export function filterAllowedFieldsWithRole(
  app: App,
  tableName: string,
  userRole: string,
  data: Record<string, unknown>
): {
  allowedData: Record<string, unknown>
  forbiddenFields: readonly string[]
} {
  const forbiddenFields = validateFieldWritePermissions(app, tableName, userRole, data)

  const allowedData = Object.fromEntries(
    Object.entries(data).filter(
      ([fieldName]) =>
        !forbiddenFields.includes(fieldName) && !SYSTEM_PROTECTED_FIELDS.has(fieldName)
    )
  )

  return { allowedData, forbiddenFields }
}

/**
 * Handle case where no fields are allowed after filtering
 */
export async function handleNoAllowedFields(config: {
  session: Session
  tableName: string
  recordId: string
  forbiddenFields: readonly string[]
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, forbiddenFields, c } = config
  // Filter out system-protected fields from forbidden list
  const attemptedForbiddenFields = forbiddenFields.filter(
    (field) => !SYSTEM_PROTECTED_FIELDS.has(field)
  )

  // If user tried to modify forbidden fields (not system-protected), return 403
  if (attemptedForbiddenFields.length > 0) {
    return c.json(
      {
        success: false,
        message: `You do not have permission to modify any of the specified fields: ${attemptedForbiddenFields.join(', ')}`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  // If only system-protected fields were filtered, return unchanged record
  try {
    const record = await Effect.runPromise(
      Effect.provide(rawGetRecordProgram(session, tableName, recordId), TableLive)
    )

    if (!record) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    return c.json({ record: transformRecord(record) }, 200)
  } catch (error) {
    return handleGetRecordError(c, error)
  }
}

/**
 * Execute update and handle RLS authorization errors
 */
export async function executeUpdate(config: {
  session: Session
  tableName: string
  recordId: string
  allowedData: Record<string, unknown>
  app: App
  userRole: string
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, app, userRole, c } = config
  try {
    const updateResult = await Effect.runPromise(
      Effect.provide(
        updateRecordProgram(session, tableName, recordId, { fields: allowedData, app, userRole }),
        TableLive
      )
    )

    // Check if update affected any rows (RLS may have blocked it)
    if (!updateResult || Object.keys(updateResult).length === 0) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    // Return flattened response format (matching GET record response structure)
    return c.json(updateResult, 200)
  } catch (error) {
    return handleUpdateError({ session, tableName, recordId, error, c })
  }
}

/**
 * Handle update errors including RLS authorization failures
 */
async function handleUpdateError(config: {
  session: Session
  tableName: string
  recordId: string
  error: unknown
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, error, c } = config
  // Check if this is an authorization error (RLS blocking the update)
  if (!isAuthorizationError(error)) {
    return handleInternalError(c, error)
  }

  // Try to read the record to differentiate between "not found" and "forbidden"
  try {
    const readResult = await Effect.runPromise(
      Effect.provide(rawGetRecordProgram(session, tableName, recordId), TableLive)
    )

    // If we can read the record but couldn't update it, return 403 Forbidden
    if (readResult !== null) {
      return c.json(
        {
          success: false,
          message: 'You do not have permission to update this record',
          code: 'FORBIDDEN',
        },
        403
      )
    }

    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  } catch {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
}
