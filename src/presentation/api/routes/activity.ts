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
 * User metadata in activity log API response
 */
interface ActivityLogResponseUser {
  readonly id: string
  readonly name: string
  readonly email: string
}

/**
 * Activity log API response type
 *
 * Maps application ActivityLogOutput to API JSON response format.
 * Uses camelCase for all fields per API conventions.
 * user is null for system-logged activities (no user_id).
 */
interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore'
  readonly tableName: string
  readonly recordId: string
  readonly user: ActivityLogResponseUser | null
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
    user: log.user,
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
 * Valid activity action types
 */
const VALID_ACTIONS = ['create', 'update', 'delete', 'restore'] as const

/**
 * Parse and validate action filter parameter
 *
 * Returns undefined if no filter, null if invalid value.
 */
function parseActionFilter(
  action: string | undefined
): 'create' | 'update' | 'delete' | 'restore' | undefined | null {
  if (action === undefined) return undefined
  if (VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
    return action as 'create' | 'update' | 'delete' | 'restore'
  }
  // eslint-disable-next-line unicorn/no-null -- Null signals invalid action (vs undefined = no filter)
  return null
}

/**
 * Check if a user is authorized to filter by the given userId
 *
 * Non-admin users can only filter by their own userId.
 * Returns true if authorized, false if forbidden.
 */
function isAuthorizedForUserIdFilter(
  sessionUserId: string,
  userIdFilter: string | undefined
): boolean {
  if (userIdFilter === undefined) return true
  return userIdFilter === sessionUserId
}

/**
 * Filter options for activity log queries
 */
interface ActivityFilters {
  readonly tableName?: string
  readonly action?: 'create' | 'update' | 'delete' | 'restore'
  readonly userId?: string
  readonly startDate?: Date
}

/**
 * Apply tableName, action, userId, and startDate filters to activity logs
 */
function applyFilters(
  logs: readonly ActivityLogOutput[],
  filters: ActivityFilters
): readonly ActivityLogOutput[] {
  return logs.filter(
    (log) =>
      (filters.tableName === undefined || log.tableName === filters.tableName) &&
      (filters.action === undefined || log.action === filters.action) &&
      (filters.userId === undefined || log.userId === filters.userId) &&
      (filters.startDate === undefined || new Date(log.createdAt) >= filters.startDate)
  )
}

/**
 * Parse query filter parameters from request context
 *
 * Returns undefined for tableName/userId if not provided,
 * null for action if invalid value provided.
 */
function parseQueryFilters(c: Context): {
  tableName: string | undefined
  action: 'create' | 'update' | 'delete' | 'restore' | undefined | null
  userId: string | undefined
  startDate: Date | undefined
} {
  return {
    tableName: c.req.query('tableName'),
    action: parseActionFilter(c.req.query('action')),
    userId: c.req.query('userId'),
    startDate:
      c.req.query('startDate') !== undefined ? new Date(c.req.query('startDate')!) : undefined,
  }
}

/**
 * Validation error response from list activity request validation
 */
interface ListActivityValidationError {
  readonly status: number
  readonly body: { success: false; message: string; code: string }
}

/**
 * Validate list activity request parameters
 *
 * Returns error response object if invalid, or undefined if valid.
 */
function validateListActivityRequest(
  c: Context,
  sessionUserId: string
): ListActivityValidationError | undefined {
  const params = parsePaginationParams(c.req.query('page'), c.req.query('pageSize'))
  if (params === undefined) {
    return {
      status: 400,
      body: { success: false, message: 'Invalid pagination parameters', code: 'INVALID_PARAMETER' },
    }
  }

  const { action } = parseQueryFilters(c)
  if (action === null) {
    return {
      status: 400,
      body: { success: false, message: 'Invalid action filter', code: 'INVALID_PARAMETER' },
    }
  }

  const userIdFilter = c.req.query('userId')
  if (!isAuthorizedForUserIdFilter(sessionUserId, userIdFilter)) {
    return {
      status: 403,
      body: {
        success: false,
        message: 'Forbidden: cannot view other users activities',
        code: 'FORBIDDEN',
      },
    }
  }

  return undefined
}

/**
 * Handle GET /api/activity - List activity logs with pagination
 */
async function handleListActivityLogs(c: Context) {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const validationError = validateListActivityRequest(c, session.userId)
  if (validationError !== undefined) {
    return c.json(validationError.body, validationError.status as 400 | 403)
  }

  const params = parsePaginationParams(c.req.query('page'), c.req.query('pageSize'))!
  const { tableName, action, userId, startDate } = parseQueryFilters(c)

  const result = await Effect.runPromise(
    ListActivityLogs({ userId: session.userId }).pipe(
      Effect.provide(ListActivityLogsLayer),
      Effect.either
    )
  )

  if (result._tag === 'Left') {
    const sanitized = sanitizeError(result.left, crypto.randomUUID())
    return c.json(
      { success: false, message: sanitized.message ?? sanitized.error, code: sanitized.code },
      getStatusCode(sanitized.code)
    )
  }

  const filtered = applyFilters(result.right, {
    tableName,
    action: action ?? undefined,
    userId,
    startDate,
  })
  return c.json(buildPaginatedResponse(filtered, params.page, params.pageSize), 200)
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
