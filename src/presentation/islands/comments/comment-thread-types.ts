/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Wire types shared by the comment-thread island and its helper files.
 *
 * These mirror the `comment-programs.ts` `formatCommentsList` response shape
 * (see `src/application/use-cases/tables/comment-programs.ts`); duplication is
 * acceptable here because the presentation layer cannot import application
 * types directly (layer boundary).
 */

export interface CommentUser {
  readonly id: string
  readonly name?: string
  readonly email?: string
  readonly image?: string | null
}

export interface CommentRecord {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  /**
   * `null` for top-level comments, otherwise the id of the parent comment
   * (single-level threading).
   */
  readonly parentCommentId: string | null
  readonly content: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly user?: CommentUser
  /**
   * Guest display name. Present only for
   * unauthenticated guest comments (`userId: null`); the author label falls
   * back to this before `user?.name`. `guestEmail` is intentionally NOT part
   * of the wire type — it is reader-private.
   */
  readonly guestName?: string | null
}

export interface CommentsListResponse {
  readonly comments: ReadonlyArray<CommentRecord>
  readonly pagination?: {
    readonly total: number
    readonly limit: number
    readonly offset: number
    readonly hasMore: boolean
  }
}

export interface CommentCreateResponse {
  readonly comment: CommentRecord
}

export interface CommentThreadIslandProps {
  readonly tableName: string
  readonly recordId: string
  readonly limit: number
  readonly sort: 'newest' | 'oldest'
  readonly paginationStyle: 'loadMore' | 'numbered'
  readonly placeholder: string
  readonly emptyText: string
  readonly currentUserId?: string
  readonly currentUserIsAdmin?: boolean
  readonly currentUserName?: string
  /**
   * When `true` (table.comments.threading === true), top-level comments
   * gain a "Reply" affordance and replies render nested below their
   * parent. Single-level only — replies themselves never expose Reply.
   */
  readonly threading?: boolean
  readonly id?: string
  readonly 'data-testid'?: string
}

export function isEdited(comment: CommentRecord): boolean {
  // The DB sets createdAt + updatedAt together on insert; later edits push
  // updatedAt forward. A small skew (<2s) covers clock jitter.
  return new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000
}

/**
 * Resolve the displayed author name for a comment.
 *
 * Single source of truth for the attribution precedence: a guest comment
 * carries `guestName` (with `userId: null`); otherwise fall back to the
 * authenticated user's name, then the supplied floor (the visible
 * `'Anonymous'` label in the thread, or a softer phrase like `'this author'`
 * in confirmation copy).
 */
export function resolveCommentAuthorName(comment: CommentRecord, fallback: string): string {
  return comment.guestName ?? comment.user?.name ?? fallback
}
