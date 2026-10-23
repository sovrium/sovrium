/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  NotificationDatabaseError,
  NotificationRepository,
  type ChosenChannels,
  type StoredNotification,
} from '@/application/ports/repositories/automations/notification-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  notificationPreferences as preferencesPg,
  notifications as notificationsPg,
} from '@/infrastructure/database/drizzle/schema/notifications'
import {
  notificationPreferences as preferencesSqlite,
  notifications as notificationsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/notifications'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { userNotificationsChannel } from '@/infrastructure/realtime/app-connections'
import { publishToChannel } from '@/infrastructure/realtime/channel-manager'

/**
 * Drizzle implementation of the notification-store port, resolved once per
 * dialect (`system.notifications` / `system.notification_preferences` on
 * PostgreSQL, their flat `system_*` twins on SQLite).
 */
const notifications = resolveDialectSchema(notificationsPg, notificationsSqlite)
const preferences = resolveDialectSchema(preferencesPg, preferencesSqlite)

const wrap = makeDbWrap((cause) => new NotificationDatabaseError({ cause }))

/** Rows per insert: well under both engines' bound-parameter ceilings at nine columns. */
const INSERT_BATCH = 500

const asDate = (value: unknown): Date =>
  value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value))

/** A nullable text column, as text or null. */
const textOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value)

const toStored = (row: Readonly<Record<string, unknown>>): StoredNotification => ({
  id: String(row['id']),
  kind: String(row['kind']),
  title: String(row['title']),
  body: textOrNull(row['body']),
  sourceTable: textOrNull(row['sourceTable']),
  sourceRecordId: textOrNull(row['sourceRecordId']),
  createdAt: asDate(row['createdAt']),
  readAt: row['readAt'] === null || row['readAt'] === undefined ? null : asDate(row['readAt']),
})

const storedRows = (rows: unknown): readonly StoredNotification[] =>
  (rows as readonly Record<string, unknown>[]).map(toStored)

/** Her listed notifications: the ones she receives in the app. */
const listedOf = (userId: string) =>
  and(eq(notifications.recipientId, userId), eq(notifications.inApp, true))

/**
 * Tell each person whose notifications changed, on her own app connections:
 * a `notifications-changed` frame naming nothing, so a bell re-reads what the
 * store answers her. Said once the write has landed, never before.
 */
const announceChanged = (userIds: Iterable<string>): Effect.Effect<void> =>
  Effect.sync(() => {
    const timestamp = new Date().toISOString()
    new Set(userIds).forEach((userId) =>
      publishToChannel(userNotificationsChannel(userId), {
        type: 'notifications-changed',
        timestamp,
      })
    )
  })

export const NotificationRepositoryLive = Layer.succeed(NotificationRepository, {
  insertMany: (rows) =>
    Effect.forEach(
      Array.from({ length: Math.ceil(rows.length / INSERT_BATCH) }, (_, index) =>
        rows.slice(index * INSERT_BATCH, (index + 1) * INSERT_BATCH)
      ),
      (batch) =>
        wrap(() =>
          db.insert(notifications).values(batch.map((row) => ({ ...row, createdAt: new Date() })))
        ),
      { discard: true }
    ).pipe(
      Effect.tap(() =>
        announceChanged(rows.filter((row) => row.inApp).map((row) => row.recipientId))
      )
    ),

  listFor: (userId, limit) =>
    wrap(() =>
      db
        .select()
        .from(notifications)
        .where(listedOf(userId))
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit)
    ).pipe(Effect.map(storedRows)),

  everyFor: (userId) =>
    wrap(() =>
      db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, userId))
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
    ).pipe(Effect.map(storedRows)),

  unreadCountFor: (userId) =>
    wrap(() =>
      db
        .select({ total: count() })
        .from(notifications)
        .where(and(listedOf(userId), isNull(notifications.readAt)))
    ).pipe(Effect.map((rows) => Number((rows as readonly { total: unknown }[])[0]?.total ?? 0))),

  markRead: ({ userId, id }) =>
    Effect.gen(function* () {
      const mine = and(listedOf(userId), eq(notifications.id, id))
      yield* wrap(() =>
        db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(and(mine, isNull(notifications.readAt)))
      )
      const marked = storedRows(
        yield* wrap(() => db.select().from(notifications).where(mine).limit(1))
      )
      // Her other tabs re-read: the item is read there too.
      if (marked.length > 0) yield* announceChanged([userId])
      return marked
    }),

  markAllRead: (userId) =>
    wrap(() =>
      db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(listedOf(userId), isNull(notifications.readAt)))
        .returning({ id: notifications.id })
    ).pipe(
      Effect.map((rows) => (rows as readonly unknown[]).length),
      Effect.tap(() => announceChanged([userId]))
    ),

  preferencesOf: (userIds) =>
    userIds.length === 0
      ? Effect.succeed([])
      : wrap(() =>
          db
            .select()
            .from(preferences)
            .where(inArray(preferences.userId, [...userIds]))
        ).pipe(
          Effect.map((rows) =>
            (rows as readonly Record<string, unknown>[]).map((row): ChosenChannels => ({
              userId: String(row['userId']),
              kind: String(row['kind']),
              inApp: Boolean(row['inApp']),
              email: Boolean(row['email']),
              digest: Boolean(row['digest']),
            }))
          )
        ),

  savePreferences: (chosen) =>
    Effect.forEach(
      chosen,
      ({ userId, kind, inApp, email, digest }) =>
        wrap(() =>
          db
            .insert(preferences)
            .values({ userId, kind, inApp, email, digest, updatedAt: new Date() })
            .onConflictDoUpdate({
              target: [preferences.userId, preferences.kind],
              set: { inApp, email, digest, updatedAt: new Date() },
            })
        ),
      { discard: true }
    ),
})
