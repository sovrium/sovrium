/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { GetRecordHistory, GetRecordHistoryLayer } from '@/application/use-cases/get-record-history'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Parse pagination query parameters
 */
function parsePaginationParams(c: Context): { limit: number; offset: number } {
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')

  const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam))) : 50
  const offset = offsetParam ? Math.max(0, Number(offsetParam)) : 0

  return { limit, offset }
}

/**
 * Handle GET /api/tables/:tableId/records/:recordId/history
 *
 * Returns activity log history for a specific record with pagination and user metadata.
 *
 * Query Parameters:
 * - limit: Number of items per page (1-100, default 50)
 * - offset: Number of items to skip (default 0)
 *
 * Response:
 * - 200: Success with history and pagination metadata
 * - 401: Unauthorized (activity APIs always require authentication)
 * - 404: Table or record not found
 * - 500: Internal server error
 */
export async function handleGetRecordHistory(c: Context, app: App) {
  const session = getSessionContext(c)

  // Activity log APIs always require authentication
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const tableId = Number(c.req.param('tableId'))
  const recordId = c.req.param('recordId')

  // Validate tableId is a valid number
  if (isNaN(tableId) || tableId <= 0) {
    return c.json({ success: false, message: 'Invalid table ID', code: 'VALIDATION_ERROR' }, 400)
  }

  // Parse pagination params
  const { limit, offset } = parsePaginationParams(c)

  // Execute use case
  const program = GetRecordHistory({
    tableId,
    recordId,
    limit,
    offset,
    app,
    userId: session.userId,
  }).pipe(Effect.provide(GetRecordHistoryLayer), Effect.either)

  const result = await Effect.runPromise(program)

  if (result._tag === 'Left') {
    const error = result.left

    // Handle table not found
    if (error._tag === 'TableNotFoundError') {
      return c.json({ success: false, message: error.message, code: 'NOT_FOUND' }, 404)
    }

    // Handle record not found (no history exists)
    if (error._tag === 'RecordNotFoundError') {
      return c.json({ success: false, message: error.message, code: 'NOT_FOUND' }, 404)
    }

    // Handle database errors
    if (error._tag === 'ActivityLogDatabaseError') {
      console.error('Activity log database error:', error.cause)
      return c.json(
        { success: false, message: 'Failed to fetch record history', code: 'INTERNAL_ERROR' },
        500
      )
    }

    // Unknown error
    return c.json({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)
  }

  // Success - return history with pagination metadata
  const { history, pagination } = result.right
  return c.json({
    history,
    pagination,
  })
}
