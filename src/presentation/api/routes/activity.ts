/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ActivityLogNotFoundError,
  GetActivityLogDetails,
  GetActivityLogDetailsLayer,
  InvalidActivityIdError,
} from '@/application/use-cases/get-activity-log-details'
import {
  type ActivityLogOutput,
  ListActivityLogs,
  ListActivityLogsLayer,
} from '@/application/use-cases/list-activity-logs'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Hono } from 'hono'

/**
 * Activity log API response type
 *
 * Maps application ActivityLogOutput to API JSON response format.
 * Uses snake_case for table_name to match API conventions.
 */
interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly table_name: string
  readonly recordId: string
}

/**
 * Map ActivityLogOutput to API response format
 */
function mapToApiResponse(log: ActivityLogOutput): ActivityLogResponse {
  return {
    id: log.id,
    createdAt: log.createdAt,
    userId: log.userId,
    action: log.action,
    table_name: log.tableName,
    recordId: log.recordId,
  }
}

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity - List activity logs (admin/member only)
 * - GET /api/activity/:activityId - Get activity log details
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with activity routes chained
 */
export function chainActivityRoutes<T extends Hono>(honoApp: T): T {
  // GET /api/activity - List activity logs
  honoApp.get('/api/activity', async (c) => {
    const session = getSessionContext(c)

    if (!session) {
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }

    const program = ListActivityLogs({
      userId: session.userId,
    }).pipe(Effect.provide(ListActivityLogsLayer), Effect.either)

    const result = await Effect.runPromise(program)

    if (result._tag === 'Left') {
      const error = result.left
      const requestId = crypto.randomUUID()

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

    const logs = result.right
    return c.json(logs.map(mapToApiResponse), 200)
  })

  // GET /api/activity/:activityId - Get activity log details
  honoApp.get('/api/activity/:activityId', async (c) => {
    const session = getSessionContext(c)

    if (!session) {
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }

    const activityId = c.req.param('activityId')

    const program = GetActivityLogDetails({
      activityId,
      userId: session.userId,
    }).pipe(Effect.provide(GetActivityLogDetailsLayer), Effect.either)

    const result = await Effect.runPromise(program)

    if (result._tag === 'Left') {
      const error = result.left
      const requestId = crypto.randomUUID()

      // Handle specific error types
      if (error instanceof InvalidActivityIdError) {
        return c.json(
          {
            success: false,
            message: 'Invalid activity ID format',
            code: 'INVALID_REQUEST',
          },
          400
        )
      }

      if (error instanceof ActivityLogNotFoundError) {
        return c.json(
          {
            success: false,
            message: 'Activity log not found',
            code: 'NOT_FOUND',
          },
          404
        )
      }

      // Generic error handling
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

    const details = result.right
    return c.json(details, 200)
  })

  return honoApp as T
}
