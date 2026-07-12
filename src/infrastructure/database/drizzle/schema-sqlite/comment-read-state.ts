/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

export const commentReadState = systemTable(
  'comment_read_state',
  {
    id: text('id').primaryKey(),

    userId: text('user_id').notNull(),

    tableId: text('table_id').notNull(),
    recordId: text('record_id').notNull(),

    lastReadAt: integer('last_read_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('idx_comment_read_state_user_table_record').on(
      table.userId,
      table.tableId,
      table.recordId
    ),
  ]
)
