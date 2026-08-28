/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
  Schema.check(
    Schema.isPattern(/^[a-f0-9-]+$/, {
      message: 'Comment ID must be a valid UUID',
    })
  ),
  Schema.brand('CommentId')
)

/** @public */
export type CommentId = typeof CommentIdSchema.Type

/**
 * Comment Content - non-empty, max 10,000 characters
 * Supports @mentions as @[user_id] format
 */
export const CommentContentSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMinLength(1, { message: 'Comment content cannot be empty' }),
    Schema.isMaxLength(10_000, {
      message: 'Comment content cannot exceed 10,000 characters',
    })
  )
)

/** @public */
export type CommentContent = typeof CommentContentSchema.Type

/**
 * Record Comment Schema
 *
 * EFFECT 4 — `optionalWith(S, { nullable: true })` has NO exact equivalent, and
 * the difference is recorded here rather than papered over. v3 decoded an
 * explicit `null` to an ABSENT key, so the decoded type was `A | undefined`.
 * `optional(NullOr(S))` keeps the `null` as a value, widening the decoded type
 * to `A | null | undefined`. Nothing regresses today — this module has zero
 * importers outside its own test, and these schemas appear in neither the
 * published JSON Schema nor the published `@sovrium/types` `.d.ts` — and the
 * widened type is the truth of the database row anyway, so a future consumer is
 * forced by the type-checker to handle the NULL these columns really carry.
 * A consumer that must reproduce v3's null-erasure needs an explicit decoding
 * transformation, not this shape.
 */
export const RecordCommentSchema = Schema.Struct({
  id: CommentIdSchema,
  recordId: Schema.String,
  tableId: Schema.String,
  userId: Schema.String,
  content: CommentContentSchema,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.optional(Schema.NullOr(Schema.DateFromString)),
  deletedAt: Schema.optional(Schema.NullOr(Schema.DateFromString)),
})

/** @public */
export type RecordComment = typeof RecordCommentSchema.Type

/**
 * Create Comment Input - content only (other fields auto-injected)
 */
export const CreateCommentInputSchema = Schema.Struct({
  content: CommentContentSchema,
})

/** @public */
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
  createdAt: Schema.DateFromString,
  user: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        email: Schema.String,
        image: Schema.optional(Schema.NullOr(Schema.String)),
      })
    )
  ),
})

/** @public */
export type CommentWithUser = typeof CommentWithUserSchema.Type
