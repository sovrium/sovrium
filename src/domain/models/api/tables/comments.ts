/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const commentUserSchema = z
  .object({
    id: z.string().describe('User identifier'),
    name: z.string().describe('User display name'),
    email: z.string().describe('User email address'),
    image: z.string().nullable().optional().describe('User avatar URL'),
  })
  .openapi('CommentUser')

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

export const commentPaginationSchema = z.object({
  total: z.number().int().describe('Total count of comments'),
  limit: z.number().int().describe('Items returned'),
  offset: z.number().int().describe('Items skipped'),
  hasMore: z.boolean().describe('Whether more results exist'),
})

export const listCommentsResponseSchema = z.object({
  comments: z.array(commentSchema).describe('List of comments'),
  pagination: commentPaginationSchema.describe('Pagination metadata'),
})

export const getCommentResponseSchema = commentSchema.describe('Single comment details')

export const createCommentResponseSchema = z.object({
  comment: commentSchema.describe('Created comment'),
})

export const updateCommentResponseSchema = commentSchema.describe('Updated comment details')


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

export const updateCommentRequestSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
})


export type Comment = z.infer<typeof commentSchema>
export type RecordHistoryEntry = z.infer<typeof recordHistoryEntrySchema>
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>
export type UpdateCommentRequest = z.infer<typeof updateCommentRequestSchema>
