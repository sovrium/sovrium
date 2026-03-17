/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Record Comment Domain Model
 *
 * Represents a comment on a table record with:
 * - Content validation (non-empty, max 10,000 chars)
 * - Support for @mentions stored as @[user_id]
 * - Auto-injected user_id from session
 * - Timestamps for audit trail
 */

/**
 * Comment ID - UUID string
 */
export const CommentIdSchema = Schema.String.pipe(
  Schema.pattern(/^[a-f0-9-]+$/, {
    message: () => 'Comment ID must be a valid UUID',
  }),
  Schema.brand('CommentId')
)

export type CommentId = typeof CommentIdSchema.Type

/**
 * Comment Content - non-empty, max 10,000 characters
 * Supports @mentions as @[user_id] format
 */
export const CommentContentSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => 'Comment content cannot be empty' }),
  Schema.maxLength(10_000, {
    message: () => 'Comment content cannot exceed 10,000 characters',
  })
)

export type CommentContent = typeof CommentContentSchema.Type

/**
 * Record Comment Schema
 */
export const RecordCommentSchema = Schema.Struct({
  id: CommentIdSchema,
  recordId: Schema.String,
  tableId: Schema.String,
  userId: Schema.String,
  content: CommentContentSchema,
  createdAt: Schema.Date,
  updatedAt: Schema.optionalWith(Schema.Date, { nullable: true }),
  deletedAt: Schema.optionalWith(Schema.Date, { nullable: true }),
})

export type RecordComment = typeof RecordCommentSchema.Type

/**
 * Create Comment Input - content only (other fields auto-injected)
 */
export const CreateCommentInputSchema = Schema.Struct({
  content: CommentContentSchema,
})

export type CreateCommentInput = typeof CreateCommentInputSchema.Type

/**
 * Comment with User Metadata (for API responses)
 */
export const CommentWithUserSchema = Schema.Struct({
  id: CommentIdSchema,
  recordId: Schema.String,
  tableId: Schema.String,
  userId: Schema.String,
  content: CommentContentSchema,
  createdAt: Schema.Date,
  user: Schema.optionalWith(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      email: Schema.String,
      image: Schema.optionalWith(Schema.String, { nullable: true }),
    }),
    { nullable: true }
  ),
})

export type CommentWithUser = typeof CommentWithUserSchema.Type
