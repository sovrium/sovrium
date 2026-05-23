/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { GetActivityById } from '@/application/use-cases/activity/programs'
import {
  type ActivityLogOutput,
  ListActivityLogs,
} from '@/application/use-cases/list-activity-logs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/utils/error-sanitizer'
import { provideActivityLive, provideListActivityLogsLive } from './activity/effect-runner'
import { listActivityEntries } from './agents/approval-store'
import type { Context, Hono } from 'hono'

interface ActivityLogResponseUser {
  readonly id: string
  readonly name: string
  readonly email: string
}

interface ActivityLogResponse {
  readonly id: string
  readonly createdAt: string
  readonly userId: string | undefined
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly tableName: string
  readonly recordId: string
  readonly user: ActivityLogResponseUser | null
}

interface PaginationMeta {
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
}

interface PaginationParams {
  readonly page: number
  readonly pageSize: number
}

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

async function handleGetActivityById(c: Context) {
  const activityId = c.req.param('activityId')!

  const program = GetActivityById(activityId).pipe(provideActivityLive)

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    const error = result.left

    if (error._tag === 'InvalidActivityIdError') {
      return c.json(
        { success: false, message: 'Invalid activity ID format', code: 'BAD_REQUEST' },
        400
      )
    }

    if (error._tag === 'ActivityNotFoundError') {
      return c.json({ success: false, message: 'Activity not found', code: 'NOT_FOUND' }, 404)
    }

    console.error('[activity] get-by-id failed', error)
    return c.json(
      { success: false, message: 'Failed to fetch activity', code: 'DATABASE_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

const VALID_ACTIONS = ['create', 'update', 'delete', 'restore', 'permanent_delete'] as const

function parseActionFilter(
  action: string | undefined
): 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete' | undefined | null {
  if (action === undefined) return undefined
  if (VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
    return action as 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  }
  return null
}

async function isAuthorizedForUserIdFilter(
  sessionUserId: string,
  userIdFilter: string | undefined
): Promise<boolean> {
  if (userIdFilter === undefined) return true
  if (userIdFilter === sessionUserId) return true
  const role = await getUserRole(sessionUserId)
  return role === 'admin'
}

interface ActivityFilters {
  readonly tableName?: string
  readonly action?: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly userId?: string
  readonly startDate?: Date
}

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

function parseQueryFilters(c: Context): {
  tableName: string | undefined
  action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete' | undefined | null
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

interface ListActivityValidationError {
  readonly status: number
  readonly body: { success: false; message: string; code: string }
}

async function validateListActivityRequest(
  c: Context,
  sessionUserId: string
): Promise<ListActivityValidationError | undefined> {
  const params = parsePaginationParams(c.req.query('page'), c.req.query('pageSize'))
  if (params === undefined) {
    return {
      status: 400,
      body: { success: false, message: 'Invalid pagination parameters', code: 'BAD_REQUEST' },
    }
  }

  const { action } = parseQueryFilters(c)
  if (action === null) {
    return {
      status: 400,
      body: { success: false, message: 'Invalid action filter', code: 'BAD_REQUEST' },
    }
  }

  const userIdFilter = c.req.query('userId')
  const authorized = await isAuthorizedForUserIdFilter(sessionUserId, userIdFilter)
  if (!authorized) {
    return {
      status: 404,
      body: {
        success: false,
        message: 'Not found',
        code: 'NOT_FOUND',
      },
    }
  }

  return undefined
}

async function handleListActivityLogs(c: Context) {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const validationError = await validateListActivityRequest(c, session.userId)
  if (validationError !== undefined) {
    return c.json(validationError.body, validationError.status as 400 | 403)
  }

  const params = parsePaginationParams(c.req.query('page'), c.req.query('pageSize'))!
  const { tableName, action, userId, startDate } = parseQueryFilters(c)

  const result = await Effect.runPromise(
    ListActivityLogs({ userId: session.userId }).pipe(provideListActivityLogsLive, Effect.either)
  )

  if (result._tag === 'Left') {
    const sanitized = sanitizeError(
      result.left,
      (c.get('requestId') as string | undefined) ?? crypto.randomUUID()
    )
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
  return c.json(
    {
      ...buildPaginatedResponse(filtered, params.page, params.pageSize),
      entries: listActivityEntries(),
    },
    200
  )
}

export function chainActivityRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/activity/:activityId', handleGetActivityById)
    .get('/api/activity', handleListActivityLogs) as T
}
