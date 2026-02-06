/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  GetRecordHistory,
  GetRecordHistoryLayer,
} from '@/application/use-cases/tables/get-record-history'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Helper: Validate authentication
 */
function validateAuth(session: unknown) {
  if (!session) {
    return {
      success: false,
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    } as const
  }
  return undefined
}

/**
 * Helper: Validate table exists
 */
function validateTable(app: App, tableIdParam: string) {
  const table = app.tables?.find((t) => t.id === Number(tableIdParam))
  if (!table) {
    return {
      success: false,
      message: 'Table not found',
      code: 'NOT_FOUND',
    } as const
  }
  return undefined
}

/**
 * Helper: Check if error is "Record not found"
 */
function isRecordNotFound(err: unknown): boolean {
  if (err instanceof Error && err.message === 'Record not found') {
    return true
  }
  if (typeof err === 'object' && err !== null && 'cause' in err) {
    return isRecordNotFound((err as { cause: unknown }).cause)
  }
  return false
}

/**
 * Helper: Handle use case error
 */
function handleError(error: { _tag: string; cause?: unknown }, c: Context) {
  const requestId = crypto.randomUUID()
  console.error('[handleGetRecordHistory] Error:', error)

  if (error._tag === 'ActivityLogDatabaseError' && isRecordNotFound(error.cause)) {
    return c.json(
      {
        success: false,
        message: 'Record not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  return c.json(
    {
      success: false,
      message: sanitized.message ?? sanitized.error,
      code: sanitized.code,
    },
    statusCode
  )
}

/**
 * GET /api/tables/:tableId/records/:recordId/history
 *
 * Returns chronological change history for a specific record
 */
export async function handleGetRecordHistory(c: Context, app: App) {
  const { session, tableName } = getTableContext(c)

  // Validate authentication
  const authError = validateAuth(session)
  if (authError) {
    return c.json(authError, 401)
  }

  const tableIdParam = c.req.param('tableId')
  const recordIdParam = c.req.param('recordId')

  // Validate table exists
  const tableError = validateTable(app, tableIdParam)
  if (tableError) {
    return c.json(tableError, 404)
  }

  // Parse pagination parameters
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam ? Number(limitParam) : undefined
  const offset = offsetParam ? Number(offsetParam) : 0

  // Call use case
  const program = GetRecordHistory({
    tableName,
    recordId: recordIdParam,
    limit,
    offset,
    checkRecordExists: true,
  }).pipe(Effect.provide(GetRecordHistoryLayer), Effect.either)

  const result = await Effect.runPromise(program)

  if (result._tag === 'Left') {
    return handleError(result.left, c)
  }

  return c.json(result.right, 200)
}
