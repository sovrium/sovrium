/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { GetRecordHistory, GetRecordHistoryLayer } from '@/application/use-cases/get-record-history'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * GET /api/tables/:tableId/records/:recordId/history
 *
 * Returns chronological change history for a specific record
 */
export async function handleGetRecordHistory(c: Context, app: App) {
  const { session, tableName } = getTableContext(c)

  // Require authentication
  if (!session) {
    return c.json(
      {
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      401
    )
  }

  const tableIdParam = c.req.param('tableId')
  const recordIdParam = c.req.param('recordId')

  // Validate table exists
  const table = app.tables?.find((t) => t.id === Number(tableIdParam))
  if (!table) {
    return c.json(
      {
        success: false,
        message: 'Table not found',
        code: 'NOT_FOUND',
      },
      404
    )
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
    const error = result.left
    const requestId = crypto.randomUUID()

    // Log error for debugging
    console.error('[handleGetRecordHistory] Error:', error)

    // Check if it's a "Record not found" error (may be nested in cause chain)
    const isRecordNotFound = (err: unknown): boolean => {
      if (err instanceof Error && err.message === 'Record not found') {
        return true
      }
      if (typeof err === 'object' && err !== null && 'cause' in err) {
        return isRecordNotFound((err as { cause: unknown }).cause)
      }
      return false
    }

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

    // Sanitize error to prevent information disclosure
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

  return c.json(result.right, 200)
}
