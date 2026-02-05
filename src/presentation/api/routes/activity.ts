/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  type ActivityLogOutput,
  type PaginatedActivityLogs,
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
 * Uses camelCase for tableName (consistent with other API responses).
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
 * Pagination metadata API response
 */
interface PaginationResponse {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

/**
 * Paginated activity logs API response
 */
interface ActivityLogsApiResponse {
  readonly activities: readonly ActivityLogResponse[]
  readonly pagination: PaginationResponse
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
 * Map PaginatedActivityLogs to API response format
 */
function mapPaginatedToApiResponse(result: PaginatedActivityLogs): ActivityLogsApiResponse {
  return {
    activities: result.activities.map(mapToApiResponse),
    pagination: result.pagination,
  }
}

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity - List activity logs with pagination (admin/member only)
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with activity routes chained
 */
export function chainActivityRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/activity', async (c) => {
    const session = getSessionContext(c)

    if (!session) {
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }

    // Extract pagination parameters from query string
    const pageParam = c.req.query('page')
    const pageSizeParam = c.req.query('pageSize')

    const page = pageParam ? parseInt(pageParam, 10) : undefined
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : undefined

    const program = ListActivityLogs({
      userId: session.userId,
      page,
      pageSize,
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

    const paginatedResult = result.right
    return c.json(mapPaginatedToApiResponse(paginatedResult), 200)
  }) as T
}
