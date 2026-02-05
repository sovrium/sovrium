/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  GetActivityLogDetails,
  GetActivityLogDetailsLayer,
  type ActivityLogDetailsOutput,
} from '@/application/use-cases/get-activity-log-details'
import {
  type ActivityLogOutput,
  ListActivityLogs,
  ListActivityLogsLayer,
} from '@/application/use-cases/list-activity-logs'
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
 * Activity log details API response type
 */
interface ActivityLogDetailsResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | null
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
    changes: log.changes as Record<string, unknown> | null,
    user: log.user,
  }
}

/**
 * Handle authentication error response
 */
function handleUnauthorized(c: Context) {
  return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
}

/**
 * Handle error response
 */
function handleError(c: Context, error: unknown) {
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
      if (!session) return handleUnauthorized(c)

      const activityId = c.req.param('activityId')
      const program = GetActivityLogDetails({ activityId }).pipe(
        Effect.provide(GetActivityLogDetailsLayer),
        Effect.either
      )

      const result = await Effect.runPromise(program)

      if (result._tag === 'Left') {
        return handleError(c, result.left)
      }

      return c.json(mapDetailsToApiResponse(result.right), 200)
    })
    .get('/api/activity', async (c) => {
      const session = getSessionContext(c)
      if (!session) return handleUnauthorized(c)

      const program = ListActivityLogs({ userId: session.userId }).pipe(
        Effect.provide(ListActivityLogsLayer),
        Effect.either
      )

      const result = await Effect.runPromise(program)

      if (result._tag === 'Left') {
        return handleError(c, result.left)
      }

      return c.json(result.right.map(mapToApiResponse), 200)
    }) as T
}
