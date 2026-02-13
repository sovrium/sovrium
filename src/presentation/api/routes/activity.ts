/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  type ActivityLogDetailsOutput,
  GetActivityLogDetails,
  GetActivityLogDetailsLayer,
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
 * Activity log details API response type
 *
 * Maps application ActivityLogDetailsOutput to API JSON response format.
 */
interface ActivityLogDetailsResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: number
  readonly changes: Record<string, unknown> | null
  readonly user: {
    readonly id: string
    readonly name: string
    readonly email: string
  } | null
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
 * Map ActivityLogDetailsOutput to API response format
 */
function mapDetailsToApiResponse(log: ActivityLogDetailsOutput): ActivityLogDetailsResponse {
  return {
    id: log.id,
    createdAt: log.createdAt,
    userId: log.userId,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    changes: log.changes,
    user: log.user,
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
  return honoApp
    .get('/api/activity/:activityId', async (c) => {
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
      }).pipe(Effect.provide(GetActivityLogDetailsLayer), Effect.either)

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

      const details = result.right
      return c.json(mapDetailsToApiResponse(details), 200)
    })
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
    }) as T
}
