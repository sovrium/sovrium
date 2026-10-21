/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AgentApprovalStore } from '@/application/ports/services/agent-approval-store'
import { GetActivityById } from '@/application/use-cases/activity/programs'
import {
  type ActivityLogOutput,
  ListActivityLogs,
} from '@/application/use-cases/list-activity-logs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { enrichUserRole } from '@/presentation/api/middleware/table'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import {
  activityAdmission,
  admitsActivityEntry,
  filterAudienceEntries,
  projectActivityActor,
  projectActivityChanges,
  projectEntryActor,
  toWireEntry,
} from './activity-reader-gate'
import { buildPaginatedResponse, parsePaginationParams } from './activity-response'
import type { ActivityLogPageQuery } from '@/application/ports/repositories/analytics/activity-log-repository'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

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

    // Anything else is the server's own failure: the canonical envelope logs
    // it with its cause and answers with the request id it can be reported by.
    return toErrorResponse(c, error)
  }

  const activity = result.success
  if (!(await admitsActivityEntry(c, app, activity))) return activityNotFound(c)

  return c.json(
    {
      ...activity,
      changes: await projectActivityChanges(c, app, activity),
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
 * Run the list query, or answer its failure as the canonical error envelope.
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
  return toErrorResponse(c, result.failure)
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
  const feed = await runDomainPromise(
    c,
    Effect.flatMap(Effect.service(AgentApprovalStore), (store) => store.activity)
  )
  const audience = await filterAudienceEntries(c, app, feed)
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
