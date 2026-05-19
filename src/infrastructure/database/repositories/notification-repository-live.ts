/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  NotificationDatabaseError,
  NotificationRepository,
} from '@/application/ports/repositories/notification-repository'
import { db } from '@/infrastructure/database'
import { notifications } from '@/infrastructure/database/drizzle/schema/notification'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new NotificationDatabaseError({ cause }))

export const NotificationRepositoryLive = Layer.succeed(NotificationRepository, {
  findByUser: (userId) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
      return rows as readonly Record<string, unknown>[]
    }),

  create: (notification) =>
    wrap(async () => {
      const [row] = await db
        .insert(notifications)
        .values({
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.message,
          ...(notification.data !== undefined ? { data: notification.data } : {}),
        })
        .returning()
      return (row ?? {}) as Record<string, unknown>
    }),

  markRead: (id) =>
    wrap(async () => {
      await db.update(notifications).set({ read: true }).where(eq(notifications.id, id))
    }),

  markAllRead: (userId) =>
    wrap(async () => {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    }),

  markDismissed: (id) =>
    wrap(async () => {
      await db.update(notifications).set({ dismissed: true }).where(eq(notifications.id, id))
    }),

  delete: (id) =>
    wrap(async () => {
      await db.delete(notifications).where(eq(notifications.id, id))
    }),
})
