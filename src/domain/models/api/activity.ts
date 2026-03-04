/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

// ============================================================================
// Activity Log Schemas
// ============================================================================

/**
 * Activity log user reference schema
 */
export const activityLogUserSchema = z
  .object({
    id: z.string().describe('User identifier'),
    name: z.string().describe('User display name'),
    email: z.string().describe('User email address'),
  })
  .openapi('ActivityLogUser')

/**
 * Activity log entry schema (list view)
 */
export const activityLogSchema = z
  .object({
    id: z.string().describe('Activity log identifier'),
    createdAt: z.string().describe('ISO 8601 timestamp of the activity'),
    userId: z.string().optional().describe('User who performed the action'),
    action: z.enum(['create', 'update', 'delete', 'restore']).describe('Action type'),
    tableName: z.string().describe('Name of the affected table'),
    recordId: z.union([z.string(), z.number()]).describe('ID of the affected record'),
    user: activityLogUserSchema.nullable().describe('User details (null for system activities)'),
  })
  .openapi('ActivityLog')

/**
 * Activity log detail schema (single view, includes changes)
 */
export const activityLogDetailSchema = activityLogSchema
  .extend({
    changes: z
      .record(z.string(), z.unknown())
      .nullable()
      .describe('Field changes (null for delete actions)'),
  })
  .openapi('ActivityLogDetail')

/**
 * Activity log pagination schema
 */
export const activityPaginationSchema = z.object({
  total: z.number().int().describe('Total count of activities'),
  page: z.number().int().describe('Current page number'),
  pageSize: z.number().int().describe('Items per page'),
  totalPages: z.number().int().describe('Total number of pages'),
})

// ============================================================================
// Activity Log Response Schemas
// ============================================================================

/**
 * List activity logs response schema
 *
 * GET /api/activity
 */
export const listActivityLogsResponseSchema = z.object({
  activities: z.array(activityLogSchema).describe('List of activity log entries'),
  pagination: activityPaginationSchema.describe('Pagination metadata'),
})

/**
 * Get activity log detail response schema
 *
 * GET /api/activity/:activityId
 */
export const getActivityLogResponseSchema = activityLogDetailSchema.describe(
  'Single activity log entry with change details'
)

// ============================================================================
// TypeScript Types
// ============================================================================

export type ActivityLogUser = z.infer<typeof activityLogUserSchema>
export type ActivityLog = z.infer<typeof activityLogSchema>
export type ActivityLogDetail = z.infer<typeof activityLogDetailSchema>
export type ListActivityLogsResponse = z.infer<typeof listActivityLogsResponseSchema>
export type GetActivityLogResponse = z.infer<typeof getActivityLogResponseSchema>
