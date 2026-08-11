/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * Record Comments Table Schema — sqlite-core mirror of `schema/record-comments.ts`.
 *
 * Enables users to add comments to records in any table, similar to Airtable/Notion.
 * Supports authenticated comments, guest comments, single-level threading, and moderation.
 *
 * Features:
 * - Authenticated comments: user_id set for logged-in users
 * - Guest comments: user_id is null, guestName/guestEmail identify the commenter
 * - Single-level threading: parentId references another comment for replies
 * - Moderation queue: status field (pending/approved/rejected) for content moderation
 * - Soft delete: deleted_at for restoration capability
 * - @mentions: Stored as user IDs in content (e.g., @[user_123])
 * - Table validation: Comments tied to specific table_id for validation
 */
export const recordComments = systemTable(
  'record_comments',
  {
    // Primary key - UUID for distributed systems compatibility.
    // pg declares no DB-side default here — id is supplied by the caller.
    id: text('id').primaryKey(),

    // Record identification
    recordId: text('record_id').notNull(),
    tableId: text('table_id').notNull(),

    // User who created the comment (null for guest comments)
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    // Guest comment fields (used when userId is null)
    guestName: text('guest_name'),
    guestEmail: text('guest_email'),

    // Comment content - supports @mentions as @[user_id] format
    // Max length enforced at application layer
    content: text('content').notNull(),

    // Single-level threading (null = top-level comment, set = reply)
    parentId: text('parent_id'),

    // Moderation status. The column default is 'approved' so a row written
    // outside the create-comment gate is visible rather than silently stuck in
    // a queue; the gate itself always resolves an explicit verdict and writes
    // it, so the default is a floor, not the normal path.
    status: text('status').notNull().default('approved'),
    moderatedAt: integer('moderated_at', { mode: 'timestamp_ms' }),
    moderatedBy: text('moderated_by').references(() => users.id, { onDelete: 'set null' }),

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),

    // Soft delete support
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    // Composite index for fetching all comments on a record (most common query)
    // Supports: GET /api/tables/:tableId/records/:recordId/comments
    // Ordered by createdAt for chronological display
    index('record_comments_record_created_idx').on(table.tableId, table.recordId, table.createdAt),

    // Composite index for user activity queries
    // Supports: GET /api/users/:userId/comments
    index('record_comments_user_created_idx').on(table.userId, table.createdAt),

    // Index for soft delete filtering
    // Supports: WHERE deleted_at IS NULL (default query behavior)
    index('record_comments_deleted_at_idx').on(table.deletedAt),

    // Index for threading queries (fetching replies to a comment)
    index('record_comments_parentId_idx').on(table.parentId),

    // Index for moderation queue (filtering by status)
    index('record_comments_status_idx').on(table.status),

    // Composite index for the `autoApprove.previouslyApproved` rung
    //: "does this guest email already have an
    // approved comment on THIS table?". All three columns are equality-matched
    // by the probe, so the index answers it directly; without it the lookup is
    // a sequential scan over every comment in the app, on a table that grows
    // with every comment ever posted.
    index('record_comments_guest_email_status_idx').on(
      table.tableId,
      table.guestEmail,
      table.status
    ),
  ]
)

// Type exports for consumers
export type RecordComment = typeof recordComments.$inferSelect
export type NewRecordComment = typeof recordComments.$inferInsert
