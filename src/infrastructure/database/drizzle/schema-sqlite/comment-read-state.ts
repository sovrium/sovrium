/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Per-user comment read-state — sqlite-core mirror of
 * `schema/comment-read-state.ts`.
 *
 * Two engine-specific translations vs the pg mapping:
 *   - Schema prefix → flat name. SQLite has no schemas; `system.comment_read_state`
 *     is invalid, so `systemTable()` maps it to `system_comment_read_state`.
 *   - `TIMESTAMPTZ` → `INTEGER` epoch-ms (`timestamp_ms` mode), matching how
 *     `record_comments.created_at` is stored on SQLite so the `created_at >
 *     last_read_at` comparison in the unread-count query is apples-to-apples.
 *
 * Engine-managed + NOT in the migration barrel — see the pg mapping's header.
 */
export const commentReadState = systemTable(
  'comment_read_state',
  {
    // Primary key — UUID supplied by the application layer (crypto.randomUUID).
    id: text('id').primaryKey(),

    // The Better Auth user whose read-state this row records.
    userId: text('user_id').notNull(),

    // Table + record identity, mirroring `record_comments.tableId/recordId`.
    tableId: text('table_id').notNull(),
    recordId: text('record_id').notNull(),

    // High-watermark: comments created after this instant are unread.
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
