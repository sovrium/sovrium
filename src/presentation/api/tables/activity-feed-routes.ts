/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AgentApprovalStore } from '@/application/ports/services/agent-approval-store'
import {
  type ActivityLogOutput,
  listActivityLogs,
} from '@/application/use-cases/activity/list-activity-logs'
import { getActivityById } from '@/application/use-cases/activity/programs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  getActivityLogResponseSchema,
  listActivityLogsResponseSchema,
} from '@/domain/models/api/activity/activity'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { enrichUserRole } from '@/presentation/api/middleware/table'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
  toErrorResponse,
} from '@/presentation/api/runtime/run-effect'
import {
  activityAdmission,
  admitsActivityEntry,
  entryReaderRows,
  filterAudienceEntries,
  projectActivityActor,
  projectActivityChanges,
  projectEntryActor,
  readerIsAdmin,
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
function handleGetActivityById(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, activityByIdResponse(c, app)))
}

/** Read, gate and answer one activity entry, as one program. */
const activityByIdResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const activityId = c.req.param('activityId')!

    const result = yield* Effect.result(getActivityById(activityId))

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
    // The caller's rows are read once, for the admission and the projection alike.
    const rows = readerIsAdmin(c, app)
      ? undefined
      : yield* entryReaderRows(c, app, activity.tableName)
    if (!(yield* admitsActivityEntry(c, app, activity, rows))) return activityNotFound(c)

    return yield* respondWith(
      c,
      Effect.succeed({
        ...activity,
        createdAt: activity.createdAt.toISOString(),
        changes: yield* projectActivityChanges(c, app, activity, rows),
        user: projectActivityActor(c, app, activity.user),
      }),
      getActivityLogResponseSchema
    )
  })

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
const isAuthorizedForUserIdFilter = (
  app: App,
  sessionUserId: string,
  userIdFilter: string | undefined
) => {
  if (userIdFilter === undefined) return Effect.succeed(true)
  if (userIdFilter === sessionUserId) return Effect.succeed(true)
  return Effect.map(getUserRole(sessionUserId), (role) => isAdminEquivalent(role, app))
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
const validateListActivityRequest = (c: Context, app: App, sessionUserId: string) =>
  Effect.gen(function* () {
    const params = parsePaginationParams(c.req.query('page'), c.req.query('pageSize'))
    if (params === undefined) {
      const invalid: ListActivityValidationError = {
        status: 400,
        body: { success: false, message: 'Invalid pagination parameters', code: 'BAD_REQUEST' },
      }
      return invalid
    }

    const { action } = parseQueryFilters(c)
    if (action === null) {
      const invalid: ListActivityValidationError = {
        status: 400,
        body: { success: false, message: 'Invalid action filter', code: 'BAD_REQUEST' },
      }
      return invalid
    }

    const userIdFilter = c.req.query('userId')
    const authorized = yield* isAuthorizedForUserIdFilter(app, sessionUserId, userIdFilter)
    if (!authorized) {
      const refused: ListActivityValidationError = {
        status: 404,
        body: {
          success: false,
          error: 'Not Found',
          message: 'Not found',
          code: 'NOT_FOUND',
        },
      }
      return refused
    }

    return undefined
  })

/**
 * Run the list query, or answer its failure as the canonical error envelope.
 */
const listActivityPage = (c: Context, query: ActivityLogPageQuery) =>
  Effect.match(listActivityLogs(query), {
    onFailure: (failure) => toErrorResponse(c, failure),
    onSuccess: (
      page
    ): { readonly activities: readonly ActivityLogOutput[]; readonly total: number } => page,
  })

/**
 * Handle GET /api/activity - List activity logs with pagination
 */
async function handleListActivityLogs(c: Context, app: App) {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }
  return runHandlerEffect(c, answerFailures(c, listActivityResponse(c, app, session.userId)))
}

/** Gate, read and answer the activity list, as one program. */
const listActivityResponse = (c: Context, app: App, sessionUserId: string) =>
  Effect.gen(function* () {
    const validationError = yield* validateListActivityRequest(c, app, sessionUserId)
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
        : yield* listActivityPage(c, {
            admission: yield* activityAdmission(c, app, tableName),
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
    const feed = yield* Effect.flatMap(
      Effect.service(AgentApprovalStore),
      (store) => store.activity
    )
    const audience = yield* filterAudienceEntries(c, app, feed)
    return yield* respondWith(
      c,
      Effect.succeed({
        ...buildPaginatedResponse(c, app, page, params),
        entries: audience.map((entry) => projectEntryActor(c, app, toWireEntry(entry))),
      }),
      listActivityLogsResponseSchema
    )
  })

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
 * @param app - The app, whose tables and permissions gate the feed
 */
export function chainActivityRoutes(honoApp: Hono, app: App): void {
  honoApp
    .get('/api/activity/:activityId', enrichUserRole(app), (c) => handleGetActivityById(c, app))
    .get('/api/activity', enrichUserRole(app), (c) => handleListActivityLogs(c, app))
}
