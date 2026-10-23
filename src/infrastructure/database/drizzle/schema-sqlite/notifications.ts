/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * Notifications — sqlite-core mirror of `schema/notifications.ts`.
 */
export const notifications = systemTable(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    sourceTable: text('source_table'),
    sourceRecordId: text('source_record_id'),
    inApp: integer('in_app', { mode: 'boolean' }).notNull().default(true),
    digest: integer('digest', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('notifications_recipient_created_idx').on(table.recipientId, table.createdAt),
    index('notifications_read_at_idx').on(table.readAt),
  ]
)

/**
 * Notification preferences — sqlite-core mirror of `schema/notifications.ts`.
 */
export const notificationPreferences = systemTable(
  'notification_preferences',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    inApp: integer('in_app', { mode: 'boolean' }).notNull(),
    email: integer('email', { mode: 'boolean' }).notNull(),
    digest: integer('digest', { mode: 'boolean' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('notification_preferences_user_kind_unique').on(table.userId, table.kind)]
)
