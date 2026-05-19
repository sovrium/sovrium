/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const CommentIdSchema = Schema.String.pipe(
  Schema.pattern(/^[a-f0-9-]+$/, {
    message: () => 'Comment ID must be a valid UUID',
  }),
  Schema.brand('CommentId')
)

export type CommentId = typeof CommentIdSchema.Type

export const CommentContentSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => 'Comment content cannot be empty' }),
  Schema.maxLength(10_000, {
    message: () => 'Comment content cannot exceed 10,000 characters',
  })
)

export type CommentContent = typeof CommentContentSchema.Type

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

export const CreateCommentInputSchema = Schema.Struct({
  content: CommentContentSchema,
})

export type CreateCommentInput = typeof CreateCommentInputSchema.Type

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
