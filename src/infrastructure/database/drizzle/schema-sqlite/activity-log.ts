/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

export type ActivityAction = 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'

export type ActivityLogChanges = {
  readonly before?: Record<string, unknown>
  readonly after?: Record<string, unknown>
}

export const activityLogs = systemTable(
  'activity_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    sessionId: text('session_id'),

    action: text('action').notNull().$type<ActivityAction>(),

    tableName: text('table_name').notNull(),
    tableId: text('table_id'),

    recordId: text('record_id').notNull(),

    changes: text('changes', { mode: 'json' }).$type<ActivityLogChanges>(),

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (table) => [
    index('activity_logs_created_at_idx').on(table.createdAt),

    index('activity_logs_user_created_at_idx').on(table.userId, table.createdAt),

    index('activity_logs_table_record_idx').on(table.tableName, table.recordId),

    index('activity_logs_action_idx').on(table.action),
  ]
)

export type ActivityLog = typeof activityLogs.$inferSelect
export type NewActivityLog = typeof activityLogs.$inferInsert
