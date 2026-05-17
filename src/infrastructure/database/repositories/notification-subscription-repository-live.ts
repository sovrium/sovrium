/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  NotificationSubscriptionDatabaseError,
  NotificationSubscriptionRepository,
} from '@/application/ports/repositories/notification-subscription-repository'
import { db } from '@/infrastructure/database'
import { notificationSubscriptions } from '@/infrastructure/database/drizzle/schema/notification'

/**
 * Notification Subscription Repository Implementation (Drizzle).
 *
 * `findByTableAndRecord` returns BOTH:
 *   - subscriptions scoped to this exact recordId
 *   - subscriptions where recordId IS NULL (table-wide)
 * so a single query gets every interested user.
 */
export const NotificationSubscriptionRepositoryLive = Layer.succeed(
  NotificationSubscriptionRepository,
  {
    create: ({ userId, tableName, recordId, fields }) =>
      Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .insert(notificationSubscriptions)
            .values({
              userId,
              tableName,
              ...(recordId !== undefined ? { recordId } : {}),
              ...(fields !== undefined ? { fields } : {}),
            })
            .returning()
          return (row ?? {}) as Record<string, unknown>
        },
        catch: (cause) => new NotificationSubscriptionDatabaseError({ cause }),
      }),

    findByUser: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select()
            .from(notificationSubscriptions)
            .where(eq(notificationSubscriptions.userId, userId))
            .orderBy(desc(notificationSubscriptions.createdAt))
          return rows as readonly Record<string, unknown>[]
        },
        catch: (cause) => new NotificationSubscriptionDatabaseError({ cause }),
      }),

    findByTableAndRecord: ({ tableName, recordId }) =>
      Effect.tryPromise({
        try: async () => {
          const recordMatch =
            recordId !== undefined
              ? or(
                  eq(notificationSubscriptions.recordId, recordId),
                  isNull(notificationSubscriptions.recordId)
                )
              : isNull(notificationSubscriptions.recordId)
          const rows = await db
            .select()
            .from(notificationSubscriptions)
            .where(and(eq(notificationSubscriptions.tableName, tableName), recordMatch))
          return rows as readonly Record<string, unknown>[]
        },
        catch: (cause) => new NotificationSubscriptionDatabaseError({ cause }),
      }),

    deleteForUser: ({ id, userId }) =>
      Effect.tryPromise({
        try: async () => {
          const deleted = await db
            .delete(notificationSubscriptions)
            .where(
              and(
                eq(notificationSubscriptions.id, id),
                eq(notificationSubscriptions.userId, userId)
              )
            )
            .returning({ id: notificationSubscriptions.id })
          return deleted.length > 0
        },
        catch: (cause) => new NotificationSubscriptionDatabaseError({ cause }),
      }),
  }
)
