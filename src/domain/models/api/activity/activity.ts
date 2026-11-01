/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

// ============================================================================
// Activity Log Schemas
// ============================================================================

/**
 * Activity log user reference schema. The email reaches an admin reader, and
 * any other reader on her own entries only.
 */
export const activityLogUserSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'User identifier' }),
  name: Schema.String.annotate({ description: 'User display name' }),
  email: optionalField(
    Schema.String.annotate({
      description:
        "User email address. Present for an admin reader, and on the reader's own entries; absent when another reader is shown someone else's entry",
    })
  ),
}).annotate({ identifier: 'ActivityLogUser' })

/**
 * Activity log entry schema (list view)
 */
export const activityLogSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Activity log identifier' }),
  createdAt: Schema.String.annotate({ description: 'ISO 8601 timestamp of the activity' }),
  userId: optionalField(Schema.String.annotate({ description: 'User who performed the action' })),
  action: Schema.Literals(['create', 'update', 'delete', 'restore', 'permanent_delete']).annotate({
    description: 'Action type',
  }),
  tableName: Schema.String.annotate({ description: 'Name of the affected table' }),
  recordId: Schema.String.annotate({
    description: 'ID of the affected record, as the records API names it',
  }),
  user: Schema.NullOr(
    activityLogUserSchema.annotate({ description: 'User details (null for system activities)' })
  ),
}).annotate({ identifier: 'ActivityLog' })

/**
 * Activity log detail schema (single view, includes changes)
 *
 * The stored row, in its own key order: the list projects its fields one by one
 * and this read spreads the row. A row whose author is gone reads with empty
 * identifiers, not with no actor.
 */
export const activityLogDetailSchema = Schema.Struct({
  id: activityLogSchema.fields.id,
  userId: Schema.String.annotate({
    description: 'User who performed the action; empty when the account is gone',
  }),
  action: activityLogSchema.fields.action,
  tableName: activityLogSchema.fields.tableName,
  recordId: activityLogSchema.fields.recordId,
  changes: Schema.NullOr(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Field changes, limited to the fields the caller may read',
    })
  ),
  createdAt: activityLogSchema.fields.createdAt,
  user: activityLogSchema.fields.user,
}).annotate({ identifier: 'ActivityLogDetail' })

/**
 * One entry of the agent activity feed: a human decision on a held call, or an
 * action an agent took. Who started the run is kept for the audience rule and
 * never reaches the wire.
 */
export const activityFeedEntrySchema = Schema.Union([
  Schema.Struct({
    action: Schema.Literals(['approval.approved', 'approval.rejected']).annotate({
      description: 'How the held call was decided',
    }),
    approvalId: Schema.String.annotate({ description: 'The approval that was decided' }),
    agentName: Schema.String.annotate({ description: 'The agent whose call was held' }),
    actor: Schema.Struct({
      id: Schema.String.annotate({ description: 'User who decided' }),
      name: Schema.String.annotate({ description: 'User display name' }),
      email: optionalField(
        Schema.String.annotate({
          description: "User email address. Present for an admin reader and on the reader's own",
        })
      ),
    }).annotate({ description: 'Who decided' }),
    id: Schema.String.annotate({ description: 'Feed entry identifier' }),
    createdAt: Schema.String.annotate({ description: 'ISO 8601 timestamp of the decision' }),
  }),
  Schema.Struct({
    id: Schema.String.annotate({ description: 'Feed entry identifier' }),
    action: Schema.String.annotate({ description: 'What the agent did' }),
    agentName: Schema.String.annotate({ description: 'The agent that acted' }),
    actor: Schema.Struct({
      type: Schema.Literal('agent'),
      name: Schema.String.annotate({ description: 'The agent name' }),
    }).annotate({ description: 'The action is attributed to the agent' }),
    targetTable: optionalField(
      Schema.String.annotate({ description: 'The table the action touched' })
    ),
    recordId: optionalField(
      Schema.String.annotate({ description: 'The record the action touched' })
    ),
    createdAt: Schema.String.annotate({ description: 'ISO 8601 timestamp of the action' }),
  }),
]).annotate({ identifier: 'ActivityFeedEntry' })

/**
 * Activity log pagination schema
 */
export const activityPaginationSchema = Schema.Struct({
  total: Schema.Int.annotate({ description: 'Total count of activities' }),
  page: Schema.Int.annotate({ description: 'Current page number' }),
  pageSize: Schema.Int.annotate({ description: 'Items per page' }),
  totalPages: Schema.Int.annotate({ description: 'Total number of pages' }),
})

// ============================================================================
// Activity Log Response Schemas
// ============================================================================

/**
 * List activity logs response schema
 *
 * GET /api/activity
 */
export const listActivityLogsResponseSchema = Schema.Struct({
  activities: Schema.Array(activityLogSchema).annotate({
    description: 'List of activity log entries',
  }),
  pagination: activityPaginationSchema.annotate({ description: 'Pagination metadata' }),
  entries: Schema.Array(activityFeedEntrySchema).annotate({
    description: 'The agent activity feed: every decision and action the caller may read',
  }),
})

/**
 * Get activity log detail response schema
 *
 * GET /api/activity/:activityId
 */
export const getActivityLogResponseSchema = activityLogDetailSchema.annotate({
  description: 'Single activity log entry with change details',
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type ActivityLogUser = typeof activityLogUserSchema.Type
export type ActivityLog = typeof activityLogSchema.Type
export type ActivityLogDetail = typeof activityLogDetailSchema.Type
export type ListActivityLogsResponse = typeof listActivityLogsResponseSchema.Type
export type GetActivityLogResponse = typeof getActivityLogResponseSchema.Type
