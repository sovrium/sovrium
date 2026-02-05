/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  type ActivityLogWithUserOutput,
  ListActivityLogsWithFilters,
  ListActivityLogsLayer,
} from '@/application/use-cases/list-activity-logs'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import type { Hono } from 'hono'

/**
 * User metadata in activity log response
 */
interface UserResponse {
  readonly id: string
  readonly name: string | null
  readonly email: string
}

/**
 * Activity log API response type
 *
 * Maps application ActivityLogWithUserOutput to API JSON response format.
 * Uses camelCase for consistency with other API responses.
 */
interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: string
  readonly user: UserResponse | undefined
}

/**
 * Pagination metadata
 */
interface PaginationResponse {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

/**
 * Activity logs list response
 */
interface ActivityLogsResponse {
  readonly activities: readonly ActivityLogResponse[]
  readonly pagination: PaginationResponse
}

/**
 * Map ActivityLogWithUserOutput to API response format
 */
function mapToApiResponse(log: ActivityLogWithUserOutput): ActivityLogResponse {
  return {
    id: log.id,
    createdAt: log.createdAt,
    userId: log.userId ?? undefined,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    user: log.user
      ? {
          id: log.user.id,
          name: log.user.name,
          email: log.user.email,
        }
      : undefined,
  }
}

/**
 * Parse query parameter as integer with default
 */
function parseIntParam(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Validate query parameters
 */
function validateQueryParams(params: {
  readonly page?: string
  readonly pageSize?: string
  readonly action?: string
}): { readonly valid: boolean; readonly message?: string } {
  // Validate page parameter
  if (params.page !== undefined) {
    const page = parseInt(params.page, 10)
    if (isNaN(page) || page < 1) {
      return { valid: false, message: 'Page parameter must be a positive integer' }
    }
  }

  // Validate pageSize parameter
  if (params.pageSize !== undefined) {
    const pageSize = parseInt(params.pageSize, 10)
    if (isNaN(pageSize) || pageSize < 1) {
      return { valid: false, message: 'PageSize parameter must be a positive integer' }
    }
    if (pageSize > 100) {
      return { valid: false, message: 'PageSize parameter cannot exceed 100' }
    }
  }

  // Validate action parameter
  if (params.action !== undefined) {
    const validActions = ['create', 'update', 'delete', 'restore']
    if (!validActions.includes(params.action)) {
      return {
        valid: false,
        message: `Action parameter must be one of: ${validActions.join(', ')}`,
      }
    }
  }

  return { valid: true }
}

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity - List activity logs with pagination and filters
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
    const queryParams = {
      page: c.req.query('page'),
      pageSize: c.req.query('pageSize'),
      action: c.req.query('action'),
      tableName: c.req.query('tableName'),
      userId: c.req.query('userId'),
      startDate: c.req.query('startDate'),
    }

    // Validate query parameters
    const validation = validateQueryParams(queryParams)
    if (!validation.valid) {
      return c.json(
        {
          success: false,
          message: validation.message!,
          code: 'INVALID_INPUT',
        },
        400
      )
    }

    // Parse pagination parameters
    const page = parseIntParam(queryParams.page, 1)
    const pageSize = parseIntParam(queryParams.pageSize, 50)

    // Parse filters
    const filters = {
      action: queryParams.action as 'create' | 'update' | 'delete' | 'restore' | undefined,
      tableName: queryParams.tableName,
      userId: queryParams.userId,
      startDate: queryParams.startDate,
    }

    const program = Effect.gen(function* () {
      return yield* ListActivityLogsWithFilters({
        userId: session.userId,
        page,
        pageSize,
        filters,
      })
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

    const { logs, total } = result.right

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize)

    const response: ActivityLogsResponse = {
      activities: logs.map(mapToApiResponse),
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    }

    return c.json(response, 200)
  }) as T
}
