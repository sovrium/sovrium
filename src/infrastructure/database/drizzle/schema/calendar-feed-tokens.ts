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
 * `system.calendar_feed_tokens` — the private feed addresses people mint for a
 * table's calendar feed (`tables[].calendarFeed`).
 *
 * One live row per person and table: minting again REPLACES the row (the old
 * address stops answering), revoking DELETES it. Only the SHA-256 hex digest of
 * the 256-bit token is stored, following `design_system_shares`: the plaintext
 * is shown once, to its owner, and never persisted or logged.
 *
 * `user_id` cascades on the account's deletion, so erasure takes every address
 * of the erased person with it.
 */
export const calendarFeedTokens = systemSchema.table(
  'calendar_feed_tokens',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tableName: text('table_name').notNull(),
    /** SHA-256 hex digest of the plaintext. NEVER the plaintext itself. */
    tokenDigest: text('token_digest').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('calendar_feed_tokens_user_table_unique').on(table.userId, table.tableName),
    uniqueIndex('calendar_feed_tokens_digest_unique').on(table.tokenDigest),
  ]
)
