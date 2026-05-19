/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

export const recordComments = systemSchema.table(
  'record_comments',
  {
    id: text('id').primaryKey(),

    recordId: text('record_id').notNull(),
    tableId: text('table_id').notNull(),

    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    guestName: text('guest_name'),
    guestEmail: text('guest_email'),

    content: text('content').notNull(),

    parentId: text('parent_id'),

    status: text('status').notNull().default('approved'),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    moderatedBy: text('moderated_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('record_comments_record_created_idx').on(table.tableId, table.recordId, table.createdAt),

    index('record_comments_user_created_idx').on(table.userId, table.createdAt),

    index('record_comments_deleted_at_idx').on(table.deletedAt),

    index('record_comments_parentId_idx').on(table.parentId),

    index('record_comments_status_idx').on(table.status),
  ]
)

export type RecordComment = typeof recordComments.$inferSelect
export type NewRecordComment = typeof recordComments.$inferInsert
