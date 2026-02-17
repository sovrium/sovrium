/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { GetActivityById } from '@/application/use-cases/activity/programs'
import {
  type ActivityLogOutput,
  ListActivityLogs,
  ListActivityLogsLayer,
} from '@/application/use-cases/list-activity-logs'
import { DatabaseLive } from '@/infrastructure/database'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Context, Hono } from 'hono'

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
 * Handle GET /api/activity/:activityId - Get activity log details
 */
async function handleGetActivityById(c: Context) {
  const activityId = c.req.param('activityId')

  const program = GetActivityById(activityId).pipe(Effect.provide(DatabaseLive))

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left

    if (error._tag === 'InvalidActivityIdError') {
      return c.json(
        { success: false, message: 'Invalid activity ID format', code: 'INVALID_ACTIVITY_ID' },
        400
      )
    }

    if (error._tag === 'ActivityNotFoundError') {
      return c.json(
        { success: false, message: 'Activity not found', code: 'ACTIVITY_NOT_FOUND' },
        404
      )
    }

    return c.json(
      { success: false, message: 'Failed to fetch activity', code: 'DATABASE_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity/:activityId - Get activity log details
 * - GET /api/activity - List activity logs (admin/member only)
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with activity routes chained
 */
export function chainActivityRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/activity/:activityId', handleGetActivityById)
    .get('/api/activity', async (c) => {
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
    }) as T
}
