/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

// ============================================================================
// Comment Schemas
// ============================================================================

/**
 * Comment user metadata schema
 */
export const commentUserSchema = z
  .object({
    id: z.string().describe('User identifier'),
    name: z.string().describe('User display name'),
    email: z.string().describe('User email address'),
    image: z.string().nullable().optional().describe('User avatar URL'),
  })
  .openapi('CommentUser')

/**
 * Comment response schema
 */
export const commentSchema = z
  .object({
    id: z.string().describe('Comment identifier'),
    content: z.string().describe('Comment content'),
    userId: z.string().describe('Author user ID'),
    recordId: z.union([z.string(), z.number()]).describe('Parent record ID'),
    tableId: z.union([z.string(), z.number()]).describe('Parent table ID'),
    createdAt: z.string().describe('ISO 8601 creation timestamp'),
    updatedAt: z.string().describe('ISO 8601 last update timestamp'),
    user: commentUserSchema.describe('Comment author details'),
  })
  .openapi('Comment')

/**
 * Comment pagination schema
 */
export const commentPaginationSchema = z.object({
  total: z.number().int().describe('Total count of comments'),
  limit: z.number().int().describe('Items returned'),
  offset: z.number().int().describe('Items skipped'),
  hasMore: z.boolean().describe('Whether more results exist'),
})

/**
 * List comments response schema
 *
 * GET /api/tables/:tableId/records/:recordId/comments
 */
export const listCommentsResponseSchema = z.object({
  comments: z.array(commentSchema).describe('List of comments'),
  pagination: commentPaginationSchema.describe('Pagination metadata'),
})

/**
 * Get single comment response schema
 *
 * GET /api/tables/:tableId/records/:recordId/comments/:commentId
 */
export const getCommentResponseSchema = commentSchema.describe('Single comment details')

/**
 * Create comment response schema
 *
 * POST /api/tables/:tableId/records/:recordId/comments
 */
export const createCommentResponseSchema = z.object({
  comment: commentSchema.describe('Created comment'),
})

/**
 * Update comment response schema
 *
 * PATCH /api/tables/:tableId/records/:recordId/comments/:commentId
 */
export const updateCommentResponseSchema = commentSchema.describe('Updated comment details')

// ============================================================================
// Record History Schemas
// ============================================================================

/**
 * Record history entry schema
 */
export const recordHistoryEntrySchema = z
  .object({
    id: z.string().describe('Activity log identifier'),
    userId: z.string().optional().describe('User who performed the action'),
    action: z.enum(['create', 'update', 'delete', 'restore']).describe('Action type'),
    tableName: z.string().describe('Name of the affected table'),
    recordId: z.union([z.string(), z.number()]).describe('ID of the affected record'),
    changes: z
      .record(z.string(), z.unknown())
      .nullable()
      .describe('Field changes (null for delete/restore)'),
    createdAt: z.string().describe('ISO 8601 timestamp'),
    user: z
      .object({
        id: z.string().describe('User identifier'),
        name: z.string().describe('User display name'),
        email: z.string().describe('User email address'),
      })
      .nullable()
      .describe('User details (null for system activities)'),
  })
  .openapi('RecordHistoryEntry')

/**
 * Get record history response schema
 *
 * GET /api/tables/:tableId/records/:recordId/history
 */
export const getRecordHistoryResponseSchema = z.object({
  history: z.array(recordHistoryEntrySchema).describe('List of history entries'),
  pagination: z
    .object({
      total: z.number().int().describe('Total activity count'),
      limit: z.number().int().describe('Items returned'),
      offset: z.number().int().describe('Items skipped'),
    })
    .optional()
    .describe('Pagination metadata'),
})

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create comment request schema
 *
 * POST /api/tables/:tableId/records/:recordId/comments
 *
 * Accepts either `content` (legacy field name) or `body` (Y-6 comment-posted
 * trigger spec): exactly one is required and both validate as a non-empty
 * string. The handler treats `body` as an alias for `content`.
 *
 * Optional fields surface to the comment-posted trigger payload:
 * - `parentCommentId` distinguishes replies from top-level comments
 * - `mentions[]` populates `{{trigger.mentions}}` (already-resolved user IDs;
 *   the engine does not re-parse `@<name>` from the body string)
 * - `authorId` is informational — the actual author is the session user
 */
export const createCommentRequestSchema = z
  .object({
    content: z.string().min(1, 'Comment content is required').optional(),
    body: z.string().min(1, 'Comment body is required').optional(),
    parentCommentId: z.string().min(1).optional(),
    mentions: z.array(z.string().min(1)).optional(),
    authorId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.content) || Boolean(value.body), {
    message: 'Either content or body is required',
  })

/**
 * Update comment request schema
 *
 * PATCH /api/tables/:tableId/records/:recordId/comments/:commentId
 */
export const updateCommentRequestSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
})

// ============================================================================
// TypeScript Types
// ============================================================================

export type Comment = z.infer<typeof commentSchema>
export type RecordHistoryEntry = z.infer<typeof recordHistoryEntrySchema>
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>
export type UpdateCommentRequest = z.infer<typeof updateCommentRequestSchema>
