/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { describedRef } from '@/domain/models/api/combinators/described-ref'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ============================================================================
// Comment Schemas
// ============================================================================

/**
 * Comment user metadata schema
 *
 * Deliberately omits `email`: the comment list/detail endpoints are
 * reader-exposed (any role with table read permission can fetch a record's
 * comments), so surfacing a commenter's email would leak PII. The display
 * surface only needs an identifier, a name, and an avatar. The author email
 * is still available server-side for the comment-posted automation trigger
 * via the shared `UserMetadata` port — it just never reaches the wire.
 */
export const commentUserSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'User identifier' }),
  name: Schema.String.annotate({ description: 'User display name' }),
  image: optionalField(Schema.NullOr(Schema.String.annotate({ description: 'User avatar URL' }))),
}).annotate({ identifier: 'CommentUser' })

/**
 * Comment response schema
 */
export const commentSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Comment identifier' }),
  content: Schema.String.annotate({ description: 'Comment content' }),
  userId: Schema.String.annotate({ description: 'Author user ID' }),
  recordId: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'Parent record ID',
  }),
  tableId: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'Parent table ID',
  }),
  createdAt: Schema.String.annotate({ description: 'ISO 8601 creation timestamp' }),
  updatedAt: Schema.String.annotate({ description: 'ISO 8601 last update timestamp' }),
  user: commentUserSchema.annotate({ description: 'Comment author details' }),
}).annotate({ identifier: 'Comment' })

/**
 * Comment pagination schema
 */
export const commentPaginationSchema = Schema.Struct({
  total: Schema.Int.annotate({ description: 'Total count of comments' }),
  limit: Schema.Int.annotate({ description: 'Items returned' }),
  offset: Schema.Int.annotate({ description: 'Items skipped' }),
  hasMore: Schema.Boolean.annotate({ description: 'Whether more results exist' }),
})

/**
 * List comments response schema
 *
 * GET /api/tables/:tableId/records/:recordId/comments
 */
export const listCommentsResponseSchema = Schema.Struct({
  comments: Schema.Array(commentSchema).annotate({ description: 'List of comments' }),
  pagination: commentPaginationSchema.annotate({ description: 'Pagination metadata' }),
})

/**
 * Get single comment response schema
 *
 * GET /api/tables/:tableId/records/:recordId/comments/:commentId
 */
export const getCommentResponseSchema = describedRef(commentSchema, 'Single comment details')

/**
 * Create comment response schema
 *
 * POST /api/tables/:tableId/records/:recordId/comments
 */
export const createCommentResponseSchema = Schema.Struct({
  comment: describedRef(commentSchema, 'Created comment'),
})

/**
 * Update comment response schema
 *
 * PATCH /api/tables/:tableId/records/:recordId/comments/:commentId
 */
export const updateCommentResponseSchema = describedRef(commentSchema, 'Updated comment details')

// ============================================================================
// Record History Schemas
// ============================================================================

/**
 * Record history entry schema
 */
export const recordHistoryEntrySchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Activity log identifier' }),
  userId: optionalField(Schema.String.annotate({ description: 'User who performed the action' })),
  action: Schema.Literals(['create', 'update', 'delete', 'restore']).annotate({
    description: 'Action type',
  }),
  tableName: Schema.String.annotate({ description: 'Name of the affected table' }),
  recordId: Schema.Union([Schema.String, Schema.Finite]).annotate({
    description: 'ID of the affected record',
  }),
  changes: Schema.NullOr(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Field changes (null for delete/restore)',
    })
  ),
  createdAt: Schema.String.annotate({ description: 'ISO 8601 timestamp' }),
  user: Schema.NullOr(
    Schema.Struct({
      id: Schema.String.annotate({ description: 'User identifier' }),
      name: Schema.String.annotate({ description: 'User display name' }),
    }).annotate({ description: 'User details (null for system activities)' })
  ),
}).annotate({ identifier: 'RecordHistoryEntry' })

/**
 * Get record history response schema
 *
 * GET /api/tables/:tableId/records/:recordId/history
 */
export const getRecordHistoryResponseSchema = Schema.Struct({
  history: Schema.Array(recordHistoryEntrySchema).annotate({
    description: 'List of history entries',
  }),
  pagination: optionalField(
    Schema.Struct({
      total: Schema.Int.annotate({ description: 'Total activity count' }),
      limit: Schema.Int.annotate({ description: 'Items returned' }),
      offset: Schema.Int.annotate({ description: 'Items skipped' }),
    }).annotate({ description: 'Pagination metadata' })
  ),
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
 *
 * NOTE (B2): guest-comment fields (`guestName`/`guestEmail`) were accepted
 * here but never persisted — the comment-create write path always wrote
 * `userId: session.userId` and dropped the guest identity. The dead fields
 * were removed; guest-comment persistence is tracked as future work and the
 * corresponding PG-02 specs are `.fixme()`-marked until the write path wires
 * the existing `guest_name`/`guest_email` columns.
 */
export const createCommentRequestSchema = Schema.Struct({
  content: optionalField(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  body: optionalField(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  parentCommentId: optionalField(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  mentions: optionalField(Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1))))),
  authorId: optionalField(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  /**
   * PG-02 honeypot field. Hidden in the SSR comment form; bots that
   * auto-fill every input give themselves away. The route silently
   * discards submissions with a non-empty value (HTTP 200, no record
   * created) before invoking the comment-create program.
   */
  honeypot: optionalField(Schema.String),
}).pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      ((value) => Boolean(value.content) || Boolean(value.body))(value)
        ? undefined
        : 'Either content or body is required'
    )
  )
)

/**
 * Update comment request schema
 *
 * PATCH /api/tables/:tableId/records/:recordId/comments/:commentId
 *
 * Two mutually-supported update modes (callers pick one):
 *
 *   - `{ content }`: comment author edits the body of their own comment.
 *   - `{ status: 'approved' | 'rejected' | 'pending' }`: admin flips the
 *     moderation state from the moderation queue (PG-02). Requires
 *     `admin` role; non-admins editing status get 404 (anti-enumeration).
 *
 * Both fields are optional individually so the handler can support
 * content-only edits AND status-only moderation actions through the
 * same endpoint. At least one must be provided.
 */
export const updateCommentRequestSchema = Schema.Struct({
  content: optionalField(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  status: optionalField(Schema.Literals(['approved', 'rejected', 'pending'])),
}).pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      ((value) => value.content !== undefined || value.status !== undefined)(value)
        ? undefined
        : 'Either content or status is required'
    )
  )
)

// ============================================================================
// TypeScript Types
// ============================================================================

export type Comment = typeof commentSchema.Type
export type RecordHistoryEntry = typeof recordHistoryEntrySchema.Type
export type CreateCommentRequest = typeof createCommentRequestSchema.Type
export type UpdateCommentRequest = typeof updateCommentRequestSchema.Type
