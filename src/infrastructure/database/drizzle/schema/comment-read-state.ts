/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * Per-user comment read-state ([internal ref], opt-in `comments.readTracking`).
 *
 * A high-watermark row per `(user_id, table_id, record_id)`: `last_read_at`
 * records the moment the user last marked that record's comments read. The
 * comment read response derives `unreadCount` by counting comments newer than
 * this watermark (or all comments when no row exists); the mark-read endpoint
 * upserts the watermark to NOW().
 *
 * Engine-managed (like `user_access` / `_webhook_deliveries`): the physical
 * table + unique index are created at boot by
 * `schema/comment-read-state-table.ts` ONLY when some table opts into
 * `comments.readTracking`. This Drizzle mapping mirrors that DDL so the
 * read-state query helpers can run type-safe inserts/selects; it is
 * intentionally NOT exported through the migration barrel (`schema.ts`), so it
 * generates no migration DDL.
 *
 * Lives in the `system` schema alongside the other engine-managed tables
 *.
 */
export const commentReadState = systemSchema.table(
  'comment_read_state',
  {
    // Primary key — UUID supplied by the application layer (crypto.randomUUID).
    id: text('id').primaryKey(),

    // The Better Auth user whose read-state this row records.
    userId: text('user_id').notNull(),

    // Table + record identity, mirroring `record_comments.tableId/recordId`
    // (the URL `:tableId` param as stored at comment-create time).
    tableId: text('table_id').notNull(),
    recordId: text('record_id').notNull(),

    // High-watermark: comments created after this instant are unread.
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One read-state row per (user, table, record) — the ON CONFLICT target
    // for the mark-read upsert.
    uniqueIndex('idx_comment_read_state_user_table_record').on(
      table.userId,
      table.tableId,
      table.recordId
    ),
  ]
)
