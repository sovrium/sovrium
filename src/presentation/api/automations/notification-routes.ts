/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `/api/notifications` — the caller's own notifications, written by the
 * `notification` action:
 *
 *   - `GET  /api/notifications` — hers, newest first, with her unread count
 *   - `POST /api/notifications/read-all` — mark every one of hers read
 *   - `POST /api/notifications/:id/read` — mark one of hers read; another
 *     person's answers the same 404 as an id that names nothing (S1)
 *   - `GET|PUT /api/notifications/preferences` — her channels per kind
 *
 * Every route answers 401 without a session, and reads or writes the caller's
 * own rows only: the recipient is always the session's user, never a
 * parameter. `POST /api/internal/notifications/retention-due` runs the daily
 * retention sweep on demand, behind the scheduler token, like its siblings.
 */

import { Effect } from 'effect'
import {
  changeMyNotificationPreferencesProgram,
  listMyNotificationsProgram,
  markAllMyNotificationsReadProgram,
  markMyNotificationReadProgram,
  myNotificationPreferencesProgram,
  toNotificationView,
} from '@/application/use-cases/automations/notification-programs'
import {
  listNotificationsResponseSchema,
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  notificationPreferencesResponseSchema,
  updateNotificationPreferencesRequestSchema,
} from '@/domain/models/api/notifications/notifications'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { purgeReadNotifications } from '@/infrastructure/database/notification-retention'
import { notFound, unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  internalSchedulerNotFound,
  isInternalSchedulerRequest,
} from '@/presentation/api/runtime/internal-scheduler-gate'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** The caller's user id, or nothing for a caller without an account. */
const callerOf = (c: Context): string | undefined => {
  const session = getSessionContext(c)
  return session === undefined || isGuestSession(session.userId) ? undefined : session.userId
}

const handleList = (c: Context): Promise<Response> | Response => {
  const userId = callerOf(c)
  if (userId === undefined) return unauthorized(c)
  return runHandlerEffect(
    c,
    respondWith(
      c,
      listMyNotificationsProgram(userId).pipe(
        Effect.map(({ notifications, unreadCount }) => ({
          notifications: notifications.map(toNotificationView),
          unreadCount,
        }))
      ),
      listNotificationsResponseSchema
    )
  )
}

const handleMarkRead = (c: Context): Promise<Response> | Response => {
  const userId = callerOf(c)
  if (userId === undefined) return unauthorized(c)
  const id = c.req.param('id') ?? ''
  return runHandlerEffect(
    c,
    markMyNotificationReadProgram(userId, id).pipe(
      Effect.flatMap((marked) =>
        marked === undefined
          ? Effect.succeed(notFound(c))
          : respondWith(
              c,
              Effect.succeed({
                notification: toNotificationView(marked.notification),
                unreadCount: marked.unreadCount,
              }),
              markNotificationReadResponseSchema
            )
      ),
      Effect.catch((error) => respondWith(c, Effect.fail(error)))
    )
  )
}

const handleMarkAllRead = (c: Context): Promise<Response> | Response => {
  const userId = callerOf(c)
  if (userId === undefined) return unauthorized(c)
  return runHandlerEffect(
    c,
    respondWith(
      c,
      markAllMyNotificationsReadProgram(userId),
      markAllNotificationsReadResponseSchema
    )
  )
}

const handleGetPreferences = (c: Context, app: App): Promise<Response> | Response => {
  const userId = callerOf(c)
  if (userId === undefined) return unauthorized(c)
  return runHandlerEffect(
    c,
    respondWith(
      c,
      myNotificationPreferencesProgram(app, userId).pipe(
        Effect.map((preferences) => ({ preferences }))
      ),
      notificationPreferencesResponseSchema
    )
  )
}

/**
 * One change per kind, the LAST one a request names: saving two rows for one
 * kind in one statement is refused by the database's upsert.
 */
const lastChangePerKind = <C extends { readonly kind: string }>(
  changes: readonly C[]
): readonly C[] => [...new Map(changes.map((change) => [change.kind, change] as const)).values()]

const handlePutPreferences = async (c: Context, app: App) => {
  const userId = callerOf(c)
  if (userId === undefined) return unauthorized(c)
  const decoded = await validateRequest(c, updateNotificationPreferencesRequestSchema)
  if (!decoded.success) return decoded.response
  return runHandlerEffect(
    c,
    changeMyNotificationPreferencesProgram(
      app,
      userId,
      lastChangePerKind(decoded.data.preferences)
    ).pipe(
      Effect.flatMap((changed) =>
        changed._tag === 'Undeclared'
          ? Effect.succeed(
              c.json(
                {
                  success: false,
                  message: `Unknown notification kind: ${changed.undeclared.join(', ')}`,
                  code: 'VALIDATION_ERROR',
                },
                400
              )
            )
          : respondWith(
              c,
              Effect.succeed({ preferences: changed.preferences }),
              notificationPreferencesResponseSchema
            )
      ),
      Effect.catch((error) => respondWith(c, Effect.fail(error)))
    )
  )
}

/** Run the read-notification retention sweep now; answers the number it deletes. */
const handleRetentionDue = async (c: Context, app: App): Promise<Response> => {
  if (!isInternalSchedulerRequest(c)) return internalSchedulerNotFound(c)
  return c.json({ deleted: await purgeReadNotifications(app) }, 200)
}

/**
 * Chain the notification routes. `read-all` and `preferences` are registered
 * before `/:id/read` reads them as an id.
 */
export function chainNotificationRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/notifications', handleList)
    .post('/api/notifications/read-all', handleMarkAllRead)
    .get('/api/notifications/preferences', (c) => handleGetPreferences(c, resolveApp()))
    .put('/api/notifications/preferences', (c) => handlePutPreferences(c, resolveApp()))
    .post('/api/notifications/:id/read', handleMarkRead)
    .post('/api/internal/notifications/retention-due', (c) =>
      handleRetentionDue(c, resolveApp())
    ) as T
}
