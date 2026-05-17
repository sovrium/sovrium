/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  NotificationPreferenceDatabaseError,
  NotificationPreferenceRepository,
} from '@/application/ports/repositories/notification-preference-repository'
import { db } from '@/infrastructure/database'
import { notificationPreferences } from '@/infrastructure/database/drizzle/schema/notification'

/**
 * Notification Preference Repository Implementation (Drizzle).
 *
 * `upsert` is read-then-write rather than ON CONFLICT because the
 * schema's index on `(user_id, event_type)` isn't unique. Adding a
 * unique constraint in a follow-up migration would simplify this to a
 * one-statement upsert; for now this keeps the row-per-pair invariant
 * via two queries.
 */
export const NotificationPreferenceRepositoryLive = Layer.succeed(
  NotificationPreferenceRepository,
  {
    findByUser: (userId) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId))
          return rows as readonly Record<string, unknown>[]
        },
        catch: (cause) => new NotificationPreferenceDatabaseError({ cause }),
      }),

    findByUserAndEvent: ({ userId, eventType }) =>
      Effect.tryPromise({
        try: async () => {
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
        },
        catch: (cause) => new NotificationPreferenceDatabaseError({ cause }),
      }),

    upsert: ({ userId, eventType, channels, enabled }) =>
      Effect.tryPromise({
        try: async () => {
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
        },
        catch: (cause) => new NotificationPreferenceDatabaseError({ cause }),
      }),
  }
)
