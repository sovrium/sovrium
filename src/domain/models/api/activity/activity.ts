/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ============================================================================
// Activity Log Schemas
// ============================================================================

/**
 * Activity log user reference schema
 */
export const activityLogUserSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'User identifier' }),
  name: Schema.String.annotate({ description: 'User display name' }),
  email: Schema.String.annotate({ description: 'User email address' }),
}).annotate({ identifier: 'ActivityLogUser' })

/**
 * Activity log entry schema (list view)
 */
export const activityLogSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Activity log identifier' }),
  createdAt: Schema.String.annotate({ description: 'ISO 8601 timestamp of the activity' }),
  userId: optionalField(Schema.String.annotate({ description: 'User who performed the action' })),
  action: Schema.Literals(['create', 'update', 'delete', 'restore']).annotate({
    description: 'Action type',
  }),
  tableName: Schema.String.annotate({ description: 'Name of the affected table' }),
  recordId: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'ID of the affected record',
  }),
  user: Schema.NullOr(
    activityLogUserSchema.annotate({ description: 'User details (null for system activities)' })
  ),
}).annotate({ identifier: 'ActivityLog' })

/**
 * Activity log detail schema (single view, includes changes)
 */
export const activityLogDetailSchema = Schema.Struct({
  ...activityLogSchema.fields,
  changes: Schema.NullOr(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Field changes (null for delete actions)',
    })
  ),
}).annotate({ title: 'sovrium:extends=ActivityLog|own=changes', identifier: 'ActivityLogDetail' })

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
