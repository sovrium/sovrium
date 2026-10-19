/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * sqlite-core mirror of `schema/calendar-feed-tokens.ts` — physical table
 * `system_calendar_feed_tokens`. See the pg module for why only a digest is
 * stored and why a mint replaces the row.
 */
export const calendarFeedTokens = systemTable(
  'calendar_feed_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    tokenDigest: text('token_digest').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('calendar_feed_tokens_user_table_unique').on(table.userId, table.tableName),
    uniqueIndex('calendar_feed_tokens_digest_unique').on(table.tokenDigest),
  ]
)
