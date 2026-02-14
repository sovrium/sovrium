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
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Hono } from 'hono'

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
  readonly changes: unknown
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
 *
 * Query parameters:
 * - page: number (default: 1, min: 1)
 * - pageSize: number (default: 50, max: 100)
 * - tableName: string (optional)
 * - action: 'create'|'update'|'delete'|'restore' (optional)
 * - userId: string (optional, non-admin can only filter by own userId)
 * - startDate: ISO 8601 string (optional)
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

    // Parse query parameters
    const pageStr = c.req.query('page')
    const pageSizeStr = c.req.query('pageSize')
    const tableName = c.req.query('tableName')
    const action = c.req.query('action') as 'create' | 'update' | 'delete' | 'restore' | undefined
    const filterUserId = c.req.query('userId')
    const startDate = c.req.query('startDate')

    const page = pageStr ? Number.parseInt(pageStr, 10) : undefined
    const pageSize = pageSizeStr ? Number.parseInt(pageSizeStr, 10) : undefined

    const program = ListActivityLogs({
      userId: session.userId,
      page,
      pageSize,
      tableName,
      action,
      filterUserId,
      startDate,
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

    const response = result.right
    return c.json(
      {
        activities: response.activities.map(mapToApiResponse),
        pagination: response.pagination,
      },
      200
    )
  }) as T
}
