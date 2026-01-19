/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp, index } from 'drizzle-orm/pg-core'
import { users, organizations } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * Record Comments Table Schema
 *
 * Enables users to add comments to records in any table, similar to Airtable/Notion.
 * Comments are flat (no threading), chronological, and support @mentions.
 *
 * Features:
 * - Multi-tenant: Isolated by organization_id
 * - Authentication required: Comments must have a user_id (no anonymous comments)
 * - Soft delete: deleted_at for restoration capability
 * - @mentions: Stored as user IDs in content (e.g., @[user_123])
 * - Table validation: Comments tied to specific table_id for validation
 *
 * Authorization:
 * - Read: Same permissions as the record itself (if you can read the record, you can read comments)
 * - Create: Any authenticated user who can read the record can comment
 * - Update: Only comment author can edit their own comments
 * - Delete: Comment author OR admins can delete comments
 *
 * Optimized for:
 * - Fetching all comments for a record (most common query)
 * - Organization-scoped queries (multi-tenant isolation)
 * - User activity lookups (all comments by a user)
 * - Soft delete filtering (excluding deleted comments by default)
 */
export const recordComments = systemSchema.table(
  'record_comments',
  {
    // Primary key - UUID for distributed systems compatibility
    id: text('id').primaryKey(),

    // Record identification
    recordId: text('record_id').notNull(),
    tableId: text('table_id').notNull(),

    // Multi-tenancy - organization isolation (required - auth must be configured)
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // User who created the comment (required - no anonymous comments)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Comment content - supports @mentions as @[user_id] format
    // Max length enforced at application layer
    content: text('content').notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    // Soft delete support
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Composite index for fetching all comments on a record (most common query)
    // Supports: GET /api/tables/:tableId/records/:recordId/comments
    // Ordered by createdAt for chronological display
    index('record_comments_record_created_idx').on(table.tableId, table.recordId, table.createdAt),

    // Composite index for organization-scoped queries (multi-tenant isolation)
    // Supports: GET /api/comments?organizationId=...
    index('record_comments_org_created_idx').on(table.organizationId, table.createdAt),

    // Composite index for user activity queries
    // Supports: GET /api/users/:userId/comments
    index('record_comments_user_created_idx').on(table.userId, table.createdAt),

    // Index for soft delete filtering
    // Supports: WHERE deleted_at IS NULL (default query behavior)
    index('record_comments_deleted_at_idx').on(table.deletedAt),

    // Composite index for organization + user queries (user's comments in their org)
    index('record_comments_org_user_idx').on(table.organizationId, table.userId),
  ]
)

// Type exports for consumers
export type RecordComment = typeof recordComments.$inferSelect
export type NewRecordComment = typeof recordComments.$inferInsert
