/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'


export const notifications = systemTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    data: text('data', { mode: 'json' }),
    read: integer('read', { mode: 'boolean' }).notNull().default(false),
    dismissed: integer('dismissed', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('notifications_userId_idx').on(table.userId),
    index('notifications_userId_read_idx').on(table.userId, table.read),
    index('notifications_createdAt_idx').on(table.createdAt),
  ]
)

export const notificationPreferences = systemTable(
  'notification_preferences',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    channels: text('channels', { mode: 'json' }).notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('notification_preferences_userId_eventType_idx').on(table.userId, table.eventType),
  ]
)

export const notificationSubscriptions = systemTable(
  'notification_subscriptions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    recordId: text('record_id'),
    fields: text('fields', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('notification_subscriptions_userId_idx').on(table.userId),
    index('notification_subscriptions_table_record_idx').on(table.tableName, table.recordId),
  ]
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect
