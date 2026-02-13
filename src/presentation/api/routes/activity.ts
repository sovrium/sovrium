/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ListActivityLogs, ListActivityLogsLayer } from '@/application/use-cases/list-activity-logs'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { ActivityAction } from '@/infrastructure/database/drizzle/schema/activity-log'
import type { Hono } from 'hono'

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity - List activity logs (admin/member only)
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with activity routes chained
 */
// eslint-disable-next-line max-lines-per-function -- Complete route handler with auth, validation, Effect program execution, and error handling
export function chainActivityRoutes<T extends Hono>(honoApp: T): T {
  // eslint-disable-next-line max-lines-per-function, max-statements -- Comprehensive route handler orchestrating auth check, query parsing, Effect program, and error responses
  return honoApp.get('/api/activity', async (c) => {
    const session = getSessionContext(c)

    if (!session) {
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }

    // Parse query parameters
    const tableName = c.req.query('tableName')
    const action = c.req.query('action') as ActivityAction | undefined
    const filterUserId = c.req.query('userId')
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const pageParam = c.req.query('page')
    const pageSizeParam = c.req.query('pageSize')

    const page = pageParam ? Number(pageParam) : undefined
    const pageSize = pageSizeParam ? Number(pageSizeParam) : undefined

    const program = ListActivityLogs({
      userId: session.userId,
      tableName,
      action,
      filterUserId,
      startDate,
      endDate,
      page,
      pageSize,
    }).pipe(Effect.provide(ListActivityLogsLayer), Effect.either)

    const result = await Effect.runPromise(program)

    if (result._tag === 'Left') {
      const error = result.left
      const requestId = crypto.randomUUID()

      // Handle ValidationError with 400 status
      if (error._tag === 'ValidationError') {
        return c.json(
          {
            success: false,
            message: error.message,
            code: 'VALIDATION_ERROR',
          },
          400
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

    const response = result.right
    return c.json(response, 200)
  }) as T
}
