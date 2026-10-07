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
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { enrichUserRole } from '@/presentation/api/middleware/table'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { sanitizeError, getStatusCode } from '@/presentation/api/runtime/error-sanitizer'
import { listActivityEntries } from '../agents/approval-store'
import {
  activityAdmission,
  admitsActivityEntry,
  filterAudienceEntries,
  projectActivityActor,
  projectActivityChanges,
  projectEntryActor,
  toWireEntry,
} from './activity-reader-gate'
import type { ActivityLogPageQuery } from '@/application/ports/repositories/analytics/activity-log-repository'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * User metadata in activity log API response. `email` is present for an admin
 * reader and on the reader's own entries only.
 */
interface ActivityLogResponseUser {
  readonly id: string
  readonly name: string
  readonly email?: string
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
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
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
function mapToApiResponse(c: Context, app: App, log: ActivityLogOutput): ActivityLogResponse {
  return {
    id: log.id,
    createdAt: log.createdAt,
    userId: log.userId,
    action: log.action,
    tableName: log.tableName,
    recordId: log.recordId,
    user: projectActivityActor(c, app, log.user),
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
 * Build the paginated response from one page of activity and the count of
 * every admitted entry the filters match.
 */
function buildPaginatedResponse(
  c: Context,
  app: App,
  {
    activities: logs,
    total,
  }: { readonly activities: readonly ActivityLogOutput[]; readonly total: number },
  params: PaginationParams
): { activities: readonly ActivityLogResponse[]; pagination: PaginationMeta } {
  const { page, pageSize } = params
  const pagination: PaginationMeta = {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
  return { activities: logs.map((log) => mapToApiResponse(c, app, log)), pagination }
}

/** The one 404 an activity id answers with: missing and not-yours alike. */
function activityNotFound(c: Context) {
  return c.json(
    { success: false, error: 'Not Found', message: 'Activity not found', code: 'NOT_FOUND' },
    404
  )
}

/**
 * Handle GET /api/activity/:activityId - Get activity log details.
 *
 * An entry the caller may not read through the records API answers exactly as
 * one that does not exist; one she may read shows only her readable fields.
 */
async function handleGetActivityById(c: Context, app: App) {
  const activityId = c.req.param('activityId')!

  const program = provideDomain(c, GetActivityById(activityId))

  const result = await runRequestEffect(c, program.pipe(Effect.result))

  if (result._tag === 'Failure') {
    const error = result.failure

    if (error._tag === 'InvalidActivityIdError') {
      return c.json(
        { success: false, message: 'Invalid activity ID format', code: 'BAD_REQUEST' },
        400
      )
    }

    if (error._tag === 'ActivityNotFoundError') {
      return activityNotFound(c)
    }

    logError('[activity] get-by-id failed', error)
    return c.json(
      { success: false, message: 'Failed to fetch activity', code: 'DATABASE_ERROR' },
      500
    )
  }

  const activity = result.success
  if (!(await admitsActivityEntry(c, app, activity))) return activityNotFound(c)

  return c.json(
    {
      ...activity,
      changes: projectActivityChanges(c, app, activity.tableName, activity.changes),
      user: projectActivityActor(c, app, activity.user),
    },
    200
  )
}

/**
 * Valid activity action types
 */
const VALID_ACTIONS = ['create', 'update', 'delete', 'restore', 'permanent_delete'] as const

/**
 * Parse and validate action filter parameter
 *
 * Returns undefined if no filter, null if invalid value.
 */
function parseActionFilter(
  action: string | undefined
): 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete' | undefined | null {
  if (action === undefined) return undefined
  if (VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
    return action as 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  }
  return null
}

/**
 * Check if a user is authorized to filter by the given userId
 *
 * An admin-equivalent caller (the built-in `admin` or the app's top role)
 * can filter by any userId; any other caller only by her own.
 * Returns true if authorized, false if forbidden.
 */
async function isAuthorizedForUserIdFilter(
  c: Context,
  app: App,
  sessionUserId: string,
  userIdFilter: string | undefined
): Promise<boolean> {
  if (userIdFilter === undefined) return true
  if (userIdFilter === sessionUserId) return true
  const role = await runDomainPromise(c, getUserRole(sessionUserId))
  return isAdminEquivalent(role, app)
}

/**
 * Parse query filter parameters from request context
 *
 * Returns undefined for tableName/userId if not provided,
 * null for action if invalid value provided.
 */
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

/**
 * Validation error response from list activity request validation
 */
interface ListActivityValidationError {
  readonly status: number
  readonly body: { success: false; error?: string; message: string; code: string }
}

/**
 * Validate list activity request parameters
 *
 * Returns error response object if invalid, or undefined if valid.
 */
async function validateListActivityRequest(
  c: Context,
  app: App,
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
  const authorized = await isAuthorizedForUserIdFilter(c, app, sessionUserId, userIdFilter)
  if (!authorized) {
    return {
      status: 404,
      body: {
        success: false,
        error: 'Not Found',
        message: 'Not found',
        code: 'NOT_FOUND',
      },
    }
  }

  return undefined
}

/**
 * Run the list query, or answer its failure as the sanitized error response.
 */
async function listActivityPage(
  c: Context,
  query: ActivityLogPageQuery
): Promise<
  { readonly activities: readonly ActivityLogOutput[]; readonly total: number } | Response
> {
  const result = await runRequestEffect(
    c,
    provideDomain(c, ListActivityLogs(query)).pipe(Effect.result)
  )
  if (result._tag === 'Success') return result.success
  const sanitized = sanitizeError(
    result.failure,
    (c.get('requestId') as string | undefined) ?? crypto.randomUUID()
  )
  return c.json(
    { success: false, message: sanitized.message ?? sanitized.error, code: sanitized.code },
    getStatusCode(sanitized.code)
  )
}

/**
 * Handle GET /api/activity - List activity logs with pagination
 */
async function handleListActivityLogs(c: Context, app: App) {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const validationError = await validateListActivityRequest(c, app, session.userId)
  if (validationError !== undefined) {
    return c.json(validationError.body, validationError.status as 400 | 403)
  }

  const params = parsePaginationParams(c.req.query('page'), c.req.query('pageSize'))!
  const { tableName, action, userId, startDate } = parseQueryFilters(c)

  // Only the entries of records the caller may read through the records API:
  // each table's gate resolved once, the rows judged, paged and counted in the
  // database, so the total counts what she is shown. A `startDate` that is no
  // date matches no entry.
  const page =
    startDate !== undefined && isNaN(startDate.getTime())
      ? { activities: [], total: 0 }
      : await listActivityPage(c, {
          admission: await activityAdmission(c, app, tableName),
          filters: { tableName, action: action ?? undefined, userId, since: startDate },
          offset: (params.page - 1) * params.pageSize,
          limit: params.pageSize,
        })
  if (page instanceof Response) return page

  // `entries` carries the AI agent-approval decision log (approval.approved /
  // approval.rejected) alongside the CRUD `activities`. It is additive — the
  // existing `{ activities, pagination }` contract is preserved for the
  // activity-monitoring specs while approval specs read `entries`. A
  // non-admin reads only the entries the audience rule admits, and another
  // user's email in them stays on admin surfaces.
  const audience = await filterAudienceEntries(c, app, listActivityEntries())
  return c.json(
    {
      ...buildPaginatedResponse(c, app, page, params),
      entries: audience.map((entry) => projectEntryActor(c, app, toWireEntry(entry))),
    },
    200
  )
}

/**
 * Chain activity routes onto a Hono app
 *
 * Provides:
 * - GET /api/activity/:activityId - Get activity log details
 * - GET /api/activity - List activity logs, narrowed to what the caller may read
 *
 * Both resolve the caller's role and groups first (`enrichUserRole`), which
 * decide what of the feed she reads.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param resolveApp - The live app, whose tables and permissions gate the feed
 * @returns Hono app with activity routes chained
 */
export function chainActivityRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/activity/:activityId', enrichUserRole(resolveApp), (c) =>
      handleGetActivityById(c, resolveApp())
    )
    .get('/api/activity', enrichUserRole(resolveApp), (c) =>
      handleListActivityLogs(c, resolveApp())
    ) as T
}
