/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { boolean, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * Notifications — the engine's notification store, one row per recipient.
 *
 * Written by the `notification` action, read by its recipient alone through
 * `/api/notifications`. A notification names its source by table and record id
 * only and copies none of its fields. `in_app` says whether the recipient lists
 * it; `digest` whether it waits for a digest to collect. A read notification is
 * deleted `notifications.retention.days` after `read_at`, a digest-only one that
 * long after `created_at`; an unread listed one stays.
 */
export const notifications = systemSchema.table(
  'notifications',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    sourceTable: text('source_table'),
    sourceRecordId: text('source_record_id'),
    inApp: boolean('in_app').notNull().default(true),
    digest: boolean('digest').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    index('notifications_recipient_created_idx').on(table.recipientId, table.createdAt),
    index('notifications_read_at_idx').on(table.readAt),
  ]
)

/**
 * Notification preferences — the channels a person chose for one kind.
 *
 * One row per `(user_id, kind)` she changed; a kind she never changed has no
 * row and reaches her on its declared defaults.
 */
export const notificationPreferences = systemSchema.table(
  'notification_preferences',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    inApp: boolean('in_app').notNull(),
    email: boolean('email').notNull(),
    digest: boolean('digest').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('notification_preferences_user_kind_unique').on(table.userId, table.kind)]
)
