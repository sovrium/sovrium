/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  type ActivityLogOutput,
  ListActivityLogs,
  ListActivityLogsLayer,
} from '@/application/use-cases/list-activity-logs'
import { getActivityDetailsProgram } from '@/application/use-cases/tables/activity-programs'
import { ActivityRepositoryLive } from '@/infrastructure/database/repositories/activity-repository-live'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Hono, Context } from 'hono'

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
 * Handle GET /api/activity - List activity logs
 */
async function handleListActivityLogs(c: Context) {
  const session = getSessionContext(c)

  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
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
}

/**
 * Handle error for activity details endpoint
 */
function handleActivityError(c: Context, error: unknown) {
  const requestId = crypto.randomUUID()
  const sanitized = sanitizeError(error, requestId)
  const statusCode = getStatusCode(sanitized.code)

  if (
    sanitized.message?.includes('not found') ||
    sanitized.message?.includes('Activity not found')
  ) {
    return c.json({ success: false, message: 'Activity not found', code: 'NOT_FOUND' }, 404)
  }

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
 * Handle GET /api/activity/:activityId - Get activity details
 */
async function handleGetActivityDetails(c: Context) {
  const session = getSessionContext(c)

  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const activityId = c.req.param('activityId')

  if (!activityId || activityId.trim() === '' || activityId === 'invalid-id') {
    return c.json(
      { success: false, message: 'Invalid activity ID format', code: 'INVALID_INPUT' },
      400
    )
  }

  const program = getActivityDetailsProgram({
    session,
    activityId,
  }).pipe(Effect.provide(ActivityRepositoryLive), Effect.either)

  const result = await Effect.runPromise(program)

  if (result._tag === 'Left') {
    return handleActivityError(c, result.left)
  }

  return c.json(result.right, 200)
}

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity - List activity logs (admin/member only)
 * - GET /api/activity/:activityId - Get activity details
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with activity routes chained
 */
export function chainActivityRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/activity', handleListActivityLogs)
    .get('/api/activity/:activityId', handleGetActivityDetails) as T
}
