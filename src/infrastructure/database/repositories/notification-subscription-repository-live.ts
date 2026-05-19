/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  NotificationSubscriptionDatabaseError,
  NotificationSubscriptionRepository,
} from '@/application/ports/repositories/notification-subscription-repository'
import { db } from '@/infrastructure/database'
import { notificationSubscriptions } from '@/infrastructure/database/drizzle/schema/notification'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new NotificationSubscriptionDatabaseError({ cause }))

export const NotificationSubscriptionRepositoryLive = Layer.succeed(
  NotificationSubscriptionRepository,
  {
    create: ({ userId, tableName, recordId, fields }) =>
      wrap(async () => {
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
      }),

    findByUser: (userId) =>
      wrap(async () => {
        const rows = await db
          .select()
          .from(notificationSubscriptions)
          .where(eq(notificationSubscriptions.userId, userId))
          .orderBy(desc(notificationSubscriptions.createdAt))
        return rows as readonly Record<string, unknown>[]
      }),

    findByTableAndRecord: ({ tableName, recordId }) =>
      wrap(async () => {
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
      }),

    deleteForUser: ({ id, userId }) =>
      wrap(async () => {
        const deleted = await db
          .delete(notificationSubscriptions)
          .where(
            and(eq(notificationSubscriptions.id, id), eq(notificationSubscriptions.userId, userId))
          )
          .returning({ id: notificationSubscriptions.id })
        return deleted.length > 0
      }),
  }
)
