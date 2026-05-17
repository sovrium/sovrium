/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  NotificationDatabaseError,
  NotificationRepository,
} from '@/application/ports/repositories/notification-repository'
import { db } from '@/infrastructure/database'
import { notifications } from '@/infrastructure/database/drizzle/schema/notification'

/**
 * Notification Repository Implementation (Drizzle).
 *
 * Backs `system.notifications` — the per-user in-app inbox. The schema
 * column for the message text is `body`; the port's `create` input uses
 * `message` for backwards-compatibility with the dispatcher's signature.
 * The mapping happens at the boundary inside `create` below.
 *
 * Reads are scoped per-user (`findByUser`) — required by spec
 * `APP-NOTIFICATIONS-020` ("users can only access their own notifications")
 * and the per-user isolation tests across multiple notification specs.
 */
export const NotificationRepositoryLive = Layer.succeed(NotificationRepository, {
  findByUser: (userId) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .orderBy(desc(notifications.createdAt))
        return rows as readonly Record<string, unknown>[]
      },
      catch: (cause) => new NotificationDatabaseError({ cause }),
    }),

  create: (notification) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(notifications)
          .values({
            userId: notification.userId,
            type: notification.type,
            title: notification.title,
            // Boundary mapping: port's `message` -> schema's `body`. The
            // dispatcher and notification-service signatures use `message`;
            // the column is `body` because the SQL convention is to
            // distinguish a notification's title from its body, not its
            // message.
            body: notification.message,
            ...(notification.data !== undefined ? { data: notification.data } : {}),
          })
          .returning()
        return (row ?? {}) as Record<string, unknown>
      },
      catch: (cause) => new NotificationDatabaseError({ cause }),
    }),

  markRead: (id) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db.update(notifications).set({ read: true }).where(eq(notifications.id, id))
      },
      catch: (cause) => new NotificationDatabaseError({ cause }),
    }),

  markAllRead: (userId) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db
          .update(notifications)
          .set({ read: true })
          .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      },
      catch: (cause) => new NotificationDatabaseError({ cause }),
    }),

  markDismissed: (id) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db.update(notifications).set({ dismissed: true }).where(eq(notifications.id, id))
      },
      catch: (cause) => new NotificationDatabaseError({ cause }),
    }),

  delete: (id) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db.delete(notifications).where(eq(notifications.id, id))
      },
      catch: (cause) => new NotificationDatabaseError({ cause }),
    }),
})
