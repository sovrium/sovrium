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
 * Uses camelCase for all fields per API conventions.
 */
interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: string
}

/**
 * Pagination metadata for list responses
 */
interface PaginationMeta {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

/**
 * Parsed and validated pagination parameters
 */
interface PaginationParams {
  readonly page: number
  readonly pageSize: number
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
    tableName: log.tableName,
    recordId: log.recordId,
  }
}

/**
 * Parse and validate pagination query parameters
 *
 * Returns undefined if parameters are invalid.
 */
function parsePaginationParams(
  pageParam: string | undefined,
  pageSizeParam: string | undefined
): PaginationParams | undefined {
  const page = pageParam === undefined ? 1 : parseInt(pageParam, 10)
  const pageSize = pageSizeParam === undefined ? 50 : parseInt(pageSizeParam, 10)

  if (isNaN(page) || page < 1) return undefined
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) return undefined

  return { page, pageSize }
}

/**
 * Build paginated response from activity log list
 */
function buildPaginatedResponse(
  logs: readonly ActivityLogOutput[],
  page: number,
  pageSize: number
): { activities: readonly ActivityLogResponse[]; pagination: PaginationMeta } {
  const total = logs.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const paginatedLogs = logs.slice(start, start + pageSize)
  const pagination: PaginationMeta = { total, page, pageSize, totalPages }
  return { activities: paginatedLogs.map(mapToApiResponse), pagination }
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
 * Handle GET /api/activity - List activity logs with pagination
 */
async function handleListActivityLogs(c: Context) {
  const session = getSessionContext(c)

  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const params = parsePaginationParams(c.req.query('page'), c.req.query('pageSize'))

  if (params === undefined) {
    return c.json(
      {
        success: false,
        message: 'Invalid pagination parameters: page must be >= 1 and pageSize must be 1-100',
        code: 'INVALID_PARAMETER',
      },
      400
    )
  }

  const program = ListActivityLogs({ userId: session.userId }).pipe(
    Effect.provide(ListActivityLogsLayer),
    Effect.either
  )

  const result = await Effect.runPromise(program)

  if (result._tag === 'Left') {
    const error = result.left
    const requestId = crypto.randomUUID()
    const sanitized = sanitizeError(error, requestId)
    const statusCode = getStatusCode(sanitized.code)

    return c.json(
      { success: false, message: sanitized.message ?? sanitized.error, code: sanitized.code },
      statusCode
    )
  }

  return c.json(buildPaginatedResponse(result.right, params.page, params.pageSize), 200)
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
    .get('/api/activity', handleListActivityLogs) as T
}
