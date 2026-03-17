/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

// ============================================================================
// OpenAPI Path Parameter Schemas
// ============================================================================

/**
 * Table ID path parameter
 */
export const tableIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
})

/**
 * Record ID path parameters (includes tableId)
 */
export const recordIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
  recordId: z.string().describe('Record identifier'),
})

/**
 * Comment ID path parameters (includes tableId and recordId)
 */
export const commentIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
  recordId: z.string().describe('Record identifier'),
  commentId: z.string().describe('Comment identifier'),
})

/**
 * View ID path parameters (includes tableId)
 */
export const viewIdParamSchema = z.object({
  tableId: z.string().describe('Table identifier'),
  viewId: z.string().describe('View identifier'),
})

/**
 * Activity ID path parameter
 */
export const activityIdParamSchema = z.object({
  activityId: z.string().describe('Activity log identifier'),
})

// ============================================================================
// OpenAPI Query Parameter Schemas
// ============================================================================

/**
 * List records query parameters
 */
export const listRecordsQuerySchema = z.object({
  page: z.string().optional().describe('Page number (1-indexed)'),
  limit: z.string().optional().describe('Items per page'),
  sort: z.string().optional().describe('Sort field'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
  format: z.enum(['raw', 'display']).optional().describe('Field value format'),
})

/**
 * Activity log query parameters
 */
export const activityQuerySchema = z.object({
  page: z.string().optional().describe('Page number'),
  pageSize: z.string().optional().describe('Items per page'),
  tableId: z.string().optional().describe('Filter by table ID'),
  action: z.enum(['create', 'update', 'delete', 'restore']).optional().describe('Filter by action'),
})

/**
 * Create/update comment request body
 */
export const commentBodySchema = z.object({
  content: z.string().min(1).max(10_000).describe('Comment text'),
})
