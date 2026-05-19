/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

export const notifications = systemSchema.table(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    data: jsonb('data'),
    read: boolean('read').notNull().default(false),
    dismissed: boolean('dismissed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_userId_idx').on(table.userId),
    index('notifications_userId_read_idx').on(table.userId, table.read),
    index('notifications_createdAt_idx').on(table.createdAt),
  ]
)

export const notificationPreferences = systemSchema.table(
  'notification_preferences',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    channels: jsonb('channels').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('notification_preferences_userId_eventType_idx').on(table.userId, table.eventType),
  ]
)

export const notificationSubscriptions = systemSchema.table(
  'notification_subscriptions',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    recordId: text('record_id'),
    fields: jsonb('fields'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
