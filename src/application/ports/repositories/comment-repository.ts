/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { UserSession } from '@/application/ports/models/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { Effect } from 'effect'

/**
 * Comment with user metadata
 */
export interface CommentWithUser {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user: UserMetadataWithOptionalImage | undefined
  readonly guestName: string | null
  readonly guestEmail: string | null
}

/**
 * Comment for authorization check (minimal fields)
 */
export interface CommentForAuth {
  readonly id: string
  readonly userId: string | null
  readonly recordId: string
  readonly tableId: string
}

/**
 * User record for authorization
 */
export interface CommentUser {
  readonly id: string
  readonly role: string | undefined
}

/**
 * Listed comment with required updatedAt
 */
export interface ListedComment {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user?: UserMetadataWithOptionalImage | undefined
  readonly guestName?: string | null
  readonly guestEmail?: string | null
}

/**
 * Comment Repository port for comment CRUD operations
 *
 * Defines the contract for comment creation, retrieval, deletion, and listing.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const comments = yield* CommentRepository
 *   const comment = yield* comments.create({ session, tableId, recordId, content })
 * })
 * ```
 */
export class CommentRepository extends Context.Tag('CommentRepository')<
  CommentRepository,
  {
    readonly create: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly recordId: string
      readonly content: string
      readonly parentId?: string
      /**
       * Guest identity. When supplied, the
       * comment is persisted with `userId: null` (a guest comment) and the
       * guest name/email columns. Omitted for authenticated comments.
       */
      readonly guestName?: string
      readonly guestEmail?: string
      /**
       * Resolved moderation status (PG-02 moderation queue). The create gate
       * combines the spam classification and the table's moderation policy
       * into a single verdict, which is persisted to the row so the comment's
       * moderation status is durable from creation. Defaults to `'approved'`
       * when omitted (column default).
       */
      readonly status?: 'approved' | 'pending' | 'rejected'
    }) => Effect.Effect<
      {
        readonly id: string
        readonly tableId: string
        readonly recordId: string
        readonly userId: string | null
        readonly content: string
        readonly parentId: string | null
        readonly status: 'approved' | 'pending' | 'rejected'
        readonly createdAt: Date
        readonly guestName: string | null
        readonly guestEmail: string | null
      },
      DatabaseError
    >

    /**
     * List distinct user IDs of all (non-deleted) comment authors on a given
     * record. Powers the comment-posted trigger's `threadParticipants`
     * derivation — returns prior authors so the caller can exclude the new
     * comment's author from the resulting list.
     */
    readonly listAuthorsForRecord: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
    }) => Effect.Effect<readonly string[], DatabaseError>

    /**
     * Distinct EMAIL ADDRESSES of all (non-deleted) comment authors on a
     * record, paired with their user id. Powers GAP-13: the comment-posted
     * trigger's `threadParticipants` resolves to email addresses so
     * `{{trigger.threadParticipants}}` is usable directly as an `email.send`
     * `to`. The caller drops the new comment's author by user id before
     * surfacing the emails.
     */
    readonly listAuthorEmailsForRecord: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
    }) => Effect.Effect<
      readonly { readonly userId: string; readonly email: string }[],
      DatabaseError
    >

    /**
     * Resolve a single user id to their email address (GAP-13 owner
     * fallback for first-comment threads). Returns `undefined` when the
     * user row does not exist.
     */
    readonly getUserEmailById: (config: {
      readonly session: Readonly<UserSession>
      readonly userId: string
    }) => Effect.Effect<string | undefined, DatabaseError>

    /**
     * Resolve a single user id to `{ id, email, name }` (GAP-20 record-event
     * trigger USER-field hydration). Reuses the same `auth.user` lookup as
     * `getUserEmailById`, projecting the display `name` alongside the email so
     * a record-event envelope can hydrate `user`-typed fields —
     * `{{trigger.data.record.<userField>.email}}` / `.name` / `.id` resolve
     * against the returned object instead of the bare id string. Returns
     * `undefined` when the user row is missing or has no email.
     */
    readonly getUserMetadataById: (config: {
      readonly session: Readonly<UserSession>
      readonly userId: string
    }) => Effect.Effect<
      { readonly id: string; readonly email: string; readonly name: string } | undefined,
      DatabaseError
    >

    /**
     * `true` when this guest email already has an approved (non-deleted)
     * comment on this table — the precondition behind
     * `comments.autoApprove.previouslyApproved`
     *.
     *
     * Exists because `resolveCommentModerationStatus` is pure and synchronous
     * by contract: the route layer resolves this boolean and passes it in as
     * `priorApprovedCommentExists`. Scoped per-table on purpose — an approval
     * earned on one table must not auto-approve the address on another.
     */
    readonly hasApprovedGuestComment: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly guestEmail: string
    }) => Effect.Effect<boolean, DatabaseError>

    readonly getWithUser: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<CommentWithUser | undefined, DatabaseError>

    readonly checkRecordExists: (config: {
      readonly session: Readonly<UserSession>
      readonly tableName: string
      readonly recordId: string
      readonly isAdmin?: boolean
    }) => Effect.Effect<boolean, DatabaseError>

    readonly getForAuth: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<CommentForAuth | undefined, DatabaseError>

    readonly getUserById: (config: {
      readonly session: Readonly<UserSession>
      readonly userId: string
    }) => Effect.Effect<CommentUser | undefined, DatabaseError>

    readonly remove: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
    }) => Effect.Effect<void, DatabaseError>

    readonly list: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
      readonly limit?: number
      readonly offset?: number
      readonly sortOrder?: 'asc' | 'desc'
      /**
       * Moderation visibility. `true` for
       * admin viewers (all statuses); `false`/omitted for non-admins and
       * guests (approved-only). Fail-closed default.
       */
      readonly includeAllStatuses?: boolean
    }) => Effect.Effect<readonly ListedComment[], DatabaseError>

    readonly getCount: (config: {
      readonly session: Readonly<UserSession>
      readonly recordId: string
      /**
       * Moderation visibility, mirrors `list` so the pagination total
       * matches what the viewer can see.
       */
      readonly includeAllStatuses?: boolean
    }) => Effect.Effect<number, DatabaseError>

    /**
     * Mark every comment on a record read for the current user ([internal ref],
     * opt-in `comments.readTracking`). Upserts the per-user high-watermark
     * row for `(user_id, table_id, record_id)` to NOW(). Idempotent.
     */
    readonly markRead: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly recordId: string
    }) => Effect.Effect<void, DatabaseError>

    /**
     * Count the comments on a record that are unread for the current user
     *. The viewer's own comments never count; a comment is unread
     * when it has no read-state watermark or was created after it. Powers the
     * `unreadCount` projection on the comment read response.
     */
    readonly countUnread: (config: {
      readonly session: Readonly<UserSession>
      readonly tableId: string
      readonly recordId: string
    }) => Effect.Effect<number, DatabaseError>

    readonly update: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
      readonly content: string
    }) => Effect.Effect<
      {
        readonly id: string
        readonly tableId: string
        readonly recordId: string
        readonly userId: string | null
        readonly content: string
        readonly createdAt: Date
        readonly updatedAt: Date
      },
      DatabaseError
    >

    /**
     * Flip the moderation status of a comment (PG-02 moderation queue).
     * Returns the updated row so the route handler can echo it back as
     * the moderation-action response. Sets `moderated_at` to NOW() and
     * `moderated_by` to the actor's session userId. Returns `undefined`
     * when the comment does not exist (admin route synthesizes a 404
     * fallback / spec-fixture synthesize path).
     */
    readonly updateStatus: (config: {
      readonly session: Readonly<UserSession>
      readonly commentId: string
      readonly status: 'approved' | 'rejected' | 'pending'
    }) => Effect.Effect<
      | {
          readonly id: string
          readonly tableId: string
          readonly recordId: string
          readonly userId: string | null
          readonly content: string
          readonly status: 'approved' | 'rejected' | 'pending'
          readonly createdAt: Date
          readonly updatedAt: Date
        }
      | undefined,
      DatabaseError
    >
  }
>() {}
