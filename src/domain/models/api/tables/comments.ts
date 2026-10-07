/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { describedRef } from '@/domain/models/api/combinators/described-ref'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { extractMentionIds } from '@/domain/models/app/tables/comment-mention-markup-service'

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
 * A person a comment mentions, resolved for display.
 *
 * A comment body carries a mention as `@[<user id>]` markup. The server lists,
 * per comment, the tokens it could resolve to a person who can read the record,
 * so a thread renders `@<name>` and never the markup. A token it could not
 * resolve (unknown user, or someone outside the record's audience) is absent
 * from this list, and the thread renders a neutral placeholder for it.
 *
 * No `email`, for the same reason as [[commentUserSchema]]: every reader of the
 * record reads this.
 */
export const commentMentionSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Mentioned user identifier' }),
  name: Schema.String.annotate({ description: 'Mentioned user display name' }),
}).annotate({ identifier: 'CommentMention' })

/**
 * Comment response schema
 */
export const commentSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Comment identifier' }),
  content: Schema.String.annotate({ description: 'Comment content' }),
  userId: Schema.String.annotate({ description: 'Author user ID' }),
  recordId: Schema.String.annotate({
    description: 'Parent record ID, as the records API names it',
  }),
  tableId: Schema.String.annotate({
    description: 'Parent table name',
  }),
  createdAt: Schema.String.annotate({ description: 'ISO 8601 creation timestamp' }),
  updatedAt: Schema.String.annotate({ description: 'ISO 8601 last update timestamp' }),
  user: commentUserSchema.annotate({ description: 'Comment author details' }),
  mentions: optionalField(
    Schema.Array(commentMentionSchema).annotate({
      description:
        'People the content mentions with @[user id] markup, resolved to display names. Lists only people who can read the record; any other token is rendered as an unknown-user placeholder.',
    })
  ),
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
 *
 * Wrapped in `comment`, like the create response, and carrying the same
 * resolved `mentions` the list gives the comment — a client refreshing one
 * comment renders it exactly as the thread does.
 */
export const getCommentResponseSchema = Schema.Struct({
  comment: describedRef(commentSchema, 'Single comment details'),
})

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
 *
 * Wrapped in `comment`, and carrying the edited body's resolved `mentions`,
 * as the create response does.
 */
export const updateCommentResponseSchema = Schema.Struct({
  comment: describedRef(commentSchema, 'Updated comment details'),
})

/**
 * A person the comment composer can mention on one record.
 *
 * Same projection as the user-field picker's directory — `{ id, name, image }`,
 * never `email` — narrowed to the people who can read the record.
 */
export const mentionableUserSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'User identifier' }),
  name: Schema.String.annotate({ description: 'User display name' }),
  image: optionalField(Schema.NullOr(Schema.String.annotate({ description: 'User avatar URL' }))),
}).annotate({ identifier: 'MentionableUser' })

/**
 * Mentionable users response schema
 *
 * GET /api/tables/:tableId/records/:recordId/comments/mentionable?q=
 *
 * The candidate source for the comment composer's `@` picker: accounts that can
 * read the record, other than the caller, matching `q`. A caller who cannot read
 * the record gets 404.
 */
export const mentionableUsersResponseSchema = Schema.Struct({
  users: Schema.Array(mentionableUserSchema).annotate({
    description: 'People who can read the record and can be mentioned on it',
  }),
})

// ============================================================================
// Record History Schemas
// ============================================================================

/**
 * Record history entry schema — one change, as `GET …/history` answers it.
 */
export const recordHistoryEntrySchema = Schema.Struct({
  action: Schema.Literals(['create', 'update', 'delete', 'restore']).annotate({
    description: 'What happened to the record',
  }),
  createdAt: Schema.String.annotate({ description: 'When it happened, as an ISO 8601 timestamp' }),
  changes: Schema.NullOr(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'The record as it was `before` and is `after` the change, each limited to the fields the caller may read; a create carries `after` only',
    })
  ),
  user: optionalField(
    Schema.Struct({
      id: Schema.String.annotate({ description: 'User identifier' }),
      name: Schema.String.annotate({ description: 'User display name' }),
      image: optionalField(
        Schema.NullOr(Schema.String).annotate({ description: 'User avatar address' })
      ),
    }).annotate({ description: 'Who made the change; absent when no user made it' })
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
 * The most people one comment may mention.
 *
 * Every mention costs an audience lookup and, for a `mentionsOnly` automation,
 * a recipient, so the list is bounded. The limit counts DISTINCT user ids
 * across the body's `@[<user id>]` markup and the `mentions` array together —
 * an id named in both is one mention. A request over the limit is refused
 * whole with a 400; no mention is silently dropped.
 */
export const MAX_COMMENT_MENTIONS = 50

/**
 * Longest comment text, in characters — the same limit for `content` and its
 * `body` alias. A guest can post on a public thread, so every field of this
 * body is bounded: an over-long value is refused with 400, never truncated.
 */
export const MAX_COMMENT_TEXT_LENGTH = 10_000

/** Longest identifier (a parent comment, an author, a mentioned user) a comment carries. */
export const MAX_COMMENT_ID_LENGTH = 128

/** Longest name a guest may sign a comment with. */
export const MAX_GUEST_NAME_LENGTH = 100

/** Longest guest email address — the longest an SMTP path can carry. */
export const MAX_GUEST_EMAIL_LENGTH = 254

/** Longest value the hidden spam-trap field is read with. */
const MAX_HONEYPOT_LENGTH = 1000

/** A non-empty string capped at `max` characters. */
const boundedString = (max: number) =>
  Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(max)))

/**
 * A string capped at `max` characters that may be empty — the guest form sends
 * an empty `guestEmail` when the thread does not require one, and the handler
 * reads an empty value as absent. The description goes before the check.
 */
const cappedString = (max: number, description: string) =>
  Schema.String.annotate({ description }).pipe(Schema.check(Schema.isMaxLength(max)))

/**
 * How many distinct people a comment names: its text's `@[<user id>]` markup
 * and its `mentions` array, merged. The text read is the one the handler
 * stores — `body` when present, else `content`.
 */
function countDistinctMentions(text: string, mentions: readonly string[]): number {
  return new Set([...extractMentionIds(text), ...mentions]).size
}

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
 * - `guestName` / `guestEmail` identify a guest author on a thread that takes
 *   guest comments; a signed-in author's identity comes from the session
 */
export const createCommentRequestSchema = Schema.Struct({
  content: optionalField(boundedString(MAX_COMMENT_TEXT_LENGTH)),
  body: optionalField(boundedString(MAX_COMMENT_TEXT_LENGTH)),
  parentCommentId: optionalField(boundedString(MAX_COMMENT_ID_LENGTH)),
  mentions: optionalField(
    Schema.Array(boundedString(MAX_COMMENT_ID_LENGTH)).annotate({
      description: `User ids the comment mentions, merged with the @[user id] markup of its text. At most ${MAX_COMMENT_MENTIONS} distinct people across both.`,
    })
  ),
  authorId: optionalField(boundedString(MAX_COMMENT_ID_LENGTH)),
  guestName: optionalField(
    cappedString(
      MAX_GUEST_NAME_LENGTH,
      `The name a guest signs a comment with, at most ${MAX_GUEST_NAME_LENGTH} characters. Ignored for a signed-in author.`
    )
  ),
  guestEmail: optionalField(
    cappedString(
      MAX_GUEST_EMAIL_LENGTH,
      `The email address a guest leaves with a comment, at most ${MAX_GUEST_EMAIL_LENGTH} characters. Never shown publicly.`
    )
  ),
  /**
   * PG-02 honeypot field. Hidden in the SSR comment form; bots that
   * auto-fill every input give themselves away. The route silently
   * discards submissions with a non-empty value (HTTP 200, no record
   * created) before invoking the comment-create program.
   */
  honeypot: optionalField(
    cappedString(MAX_HONEYPOT_LENGTH, 'Hidden spam trap; a human leaves it empty.')
  ),
}).pipe(
  Schema.check(
    Schema.makeFilter((value) =>
      ((value) => Boolean(value.content) || Boolean(value.body))(value)
        ? undefined
        : 'Either content or body is required'
    ),
    Schema.makeFilter((value) =>
      countDistinctMentions(value.body ?? value.content ?? '', value.mentions ?? []) <=
      MAX_COMMENT_MENTIONS
        ? undefined
        : `A comment can mention at most ${MAX_COMMENT_MENTIONS} people`
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
