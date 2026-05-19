/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  NotificationPreferenceDatabaseError,
  NotificationPreferenceRepository,
} from '@/application/ports/repositories/notification-preference-repository'
import { db } from '@/infrastructure/database'
import { notificationPreferences } from '@/infrastructure/database/drizzle/schema/notification'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new NotificationPreferenceDatabaseError({ cause }))

export const NotificationPreferenceRepositoryLive = Layer.succeed(
  NotificationPreferenceRepository,
  {
    findByUser: (userId) =>
      wrap(async () => {
        const rows = await db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, userId))
        return rows as readonly Record<string, unknown>[]
      }),

    findByUserAndEvent: ({ userId, eventType }) =>
      wrap(async () => {
        const rows = await db
          .select()
          .from(notificationPreferences)
          .where(
            and(
              eq(notificationPreferences.userId, userId),
              eq(notificationPreferences.eventType, eventType)
            )
          )
          .limit(1)
        return rows[0] as Record<string, unknown> | undefined
      }),

    upsert: ({ userId, eventType, channels, enabled }) =>
      wrap(async () => {
        const existing = await db
          .select({ id: notificationPreferences.id })
          .from(notificationPreferences)
          .where(
            and(
              eq(notificationPreferences.userId, userId),
              eq(notificationPreferences.eventType, eventType)
            )
          )
          .limit(1)

        if (existing[0] !== undefined) {
          const [row] = await db
            .update(notificationPreferences)
            .set({
              channels,
              ...(enabled !== undefined ? { enabled } : {}),
            })
            .where(eq(notificationPreferences.id, existing[0].id))
            .returning()
          return (row ?? {}) as Record<string, unknown>
        }

        const [row] = await db
          .insert(notificationPreferences)
          .values({
            userId,
            eventType,
            channels,
            ...(enabled !== undefined ? { enabled } : {}),
          })
          .returning()
        return (row ?? {}) as Record<string, unknown>
      }),
  }
)
