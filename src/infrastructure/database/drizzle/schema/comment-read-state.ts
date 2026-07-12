/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

export const commentReadState = systemSchema.table(
  'comment_read_state',
  {
    id: text('id').primaryKey(),

    userId: text('user_id').notNull(),

    tableId: text('table_id').notNull(),
    recordId: text('record_id').notNull(),

    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_comment_read_state_user_table_record').on(
      table.userId,
      table.tableId,
      table.recordId
    ),
  ]
)
