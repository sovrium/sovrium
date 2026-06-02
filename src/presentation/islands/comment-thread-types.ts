/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
  readonly parentCommentId: string | null
  readonly content: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly user?: CommentUser
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
  readonly threading?: boolean
  readonly id?: string
  readonly 'data-testid'?: string
}

export function isEdited(comment: CommentRecord): boolean {
  return new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000
}

export function resolveCommentAuthorName(comment: CommentRecord, fallback: string): string {
  return comment.guestName ?? comment.user?.name ?? fallback
}
