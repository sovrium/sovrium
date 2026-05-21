/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

export const recordComments = systemTable(
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
    moderatedAt: integer('moderated_at', { mode: 'timestamp_ms' }),
    moderatedBy: text('moderated_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),

    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
