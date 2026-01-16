/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { updateRecordProgram, rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { transformRecord } from '@/application/use-cases/tables/utils/record-transformer'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { handleGetRecordError, handleInternalError } from './error-handlers'
import { isAuthorizationError, type Session } from './utils'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

const SYSTEM_PROTECTED_FIELDS = new Set(['organization_id', 'user_id', 'owner_id'])

/**
 * Check if user has table-level update permission
 */
export async function checkTableUpdatePermission(
  app: App,
  tableName: string,
  session: Session,
  c: Context
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const userRole = await getUserRole(session.userId, session.activeOrganizationId)
  const table = app.tables?.find((t) => t.name === tableName)
  const updatePermission = table?.permissions?.update

  if (updatePermission?.type === 'roles') {
    const allowedRoles = updatePermission.roles || []
    if (!allowedRoles.includes(userRole)) {
      return {
        allowed: false,
        response: c.json(
          {
            error: 'Forbidden',
            message: 'You do not have permission to update records in this table',
          },
          403
        ),
      }
    }
  }

  return { allowed: true }
}

/**
 * Filter update data to only include fields user has permission to modify
 */
export async function filterAllowedFields(
  app: App,
  tableName: string,
  session: Session,
  data: Record<string, unknown>
): Promise<{
  allowedData: Record<string, unknown>
  forbiddenFields: readonly string[]
}> {
  const userRole = await getUserRole(session.userId, session.activeOrganizationId)
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
        error: 'Forbidden',
        message: `You do not have permission to modify any of the specified fields: ${attemptedForbiddenFields.join(', ')}`,
      },
      403
    )
  }

  // If only system-protected fields were filtered, return unchanged record
  try {
    const record = await Effect.runPromise(rawGetRecordProgram(session, tableName, recordId))

    if (!record) {
      return c.json({ error: 'Record not found' }, 404)
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
  c: Context
}): Promise<Response> {
  const { session, tableName, recordId, allowedData, c } = config
  try {
    const updateResult = await Effect.runPromise(
      updateRecordProgram(session, tableName, recordId, allowedData)
    )

    // Check if update affected any rows (RLS may have blocked it)
    if (!updateResult.record || Object.keys(updateResult.record).length === 0) {
      return c.json({ error: 'Record not found' }, 404)
    }

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
    const readResult = await Effect.runPromise(rawGetRecordProgram(session, tableName, recordId))

    // If we can read the record but couldn't update it, return 403 Forbidden
    if (readResult !== null) {
      return c.json({ error: 'Forbidden: You do not have permission to update this record' }, 403)
    }

    return c.json({ error: 'Record not found' }, 404)
  } catch {
    return c.json({ error: 'Record not found' }, 404)
  }
}
