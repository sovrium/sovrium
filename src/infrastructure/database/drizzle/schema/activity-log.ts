/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * Activity Action Type
 *
 * Defines the types of actions that can be recorded in the activity log.
 * - create: A new record was created
 * - update: An existing record was modified
 * - delete: A record was soft-deleted or hard-deleted
 * - restore: A soft-deleted record was restored
 */
export type ActivityAction = 'create' | 'update' | 'delete' | 'restore'

/**
 * Activity Log Changes Type
 *
 * Captures the before/after state of record modifications.
 * - For 'create': only 'after' is populated
 * - For 'update': both 'before' and 'after' are populated with changed fields
 * - For 'delete': only 'before' is populated (or null for hard deletes)
 * - For 'restore': both 'before' and 'after' are populated
 */
export type ActivityLogChanges = {
  readonly before?: Record<string, unknown>
  readonly after?: Record<string, unknown>
}

/**
 * Activity Log Table Schema
 *
 * Central audit log tracking all data modifications across the application.
 * Optimized for:
 * - Time-range queries (recent activity)
 * - User activity lookups (user audit trail)
 * - Record history queries (record-specific changes)
 *
 * Retention: 1 year (compliance requirement)
 *
 * Authentication Optional:
 * - userId is nullable to support anonymous activity logging
 * - When Better Auth is not configured, activities are logged without user context
 */
export const activityLogs = systemSchema.table(
  'activity_logs',
  {
    // Primary key - UUID for distributed systems compatibility
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Event metadata
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    // User who performed the action (null when auth disabled)
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    // Optional session tracking for additional context
    sessionId: text('session_id'),

    // Action type: create, update, delete, restore
    action: text('action').notNull().$type<ActivityAction>(),

    // Table identification
    tableName: text('table_name').notNull(),
    tableId: text('table_id').notNull(),

    // Record identification within the table
    recordId: text('record_id').notNull(),

    // Change tracking - JSONB for efficient storage and querying
    // Contains { before?: {...}, after?: {...} }
    changes: jsonb('changes').$type<ActivityLogChanges>(),

    // Request context for security auditing
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (table) => [
    // Index for recent activity queries (most common)
    // Supports: GET /api/activity (sorted by createdAt DESC)
    index('activity_logs_created_at_idx').on(table.createdAt),

    // Composite index for user activity queries
    // Supports: GET /api/users/:userId/activity
    index('activity_logs_user_created_at_idx').on(table.userId, table.createdAt),

    // Composite index for record history queries
    // Supports: GET /api/tables/:tableId/records/:recordId/history
    index('activity_logs_table_record_idx').on(table.tableName, table.recordId),

    // Index for filtering by action type
    // Supports: GET /api/activity?action=create
    index('activity_logs_action_idx').on(table.action),
  ]
)

// Type exports for consumers
export type ActivityLog = typeof activityLogs.$inferSelect
export type NewActivityLog = typeof activityLogs.$inferInsert
