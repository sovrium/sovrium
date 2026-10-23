/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * Read state — how far each person has read each parent record of a
 * `readState` relationship (a channel of messages).
 *
 * One row per `(user_id, table_name, record_id)`: `last_read_at` is the moment
 * she last marked the parent read, and the parent's unread count is the
 * children created after it that she may read, her own excepted. Personal
 * data: listed in her account export and deleted with her account.
 */
export const readState = systemSchema.table(
  'read_state',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('read_state_user_record_unique').on(table.userId, table.tableName, table.recordId),
  ]
)
