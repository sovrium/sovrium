/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactElement } from 'react'
import { buildListUrl, deleteCommentApi, patchComment, postComment } from './comment-thread-api'
import { LoadMoreButton, NumberedPagination, SortDropdown } from './comment-thread-controls'
import { CommentThreadForm } from './comment-thread-form'
import { CommentThreadItem } from './comment-thread-item'
import { computeCommentThreadClasses } from './specialty-islands-default-classes'
import type { CommentsListResponse, CommentThreadIslandProps } from './comment-thread-types'


interface CommentListProps {
  readonly comments: CommentsListResponse['comments']
  readonly currentUserId?: string
  readonly currentUserIsAdmin?: boolean
  readonly threading: boolean
  readonly isSaving: boolean
  readonly isDeleting: boolean
  readonly isReplying: boolean
  readonly onSaveEdit: (id: string, content: string) => Promise<void>
  readonly onConfirmDelete: (id: string) => Promise<void>
  readonly onSubmitReply: (parentCommentId: string, content: string) => Promise<void>
}

function renderItem(
  comment: CommentsListResponse['comments'][number],
  props: CommentListProps,
  children?: ReactElement
): ReactElement {
  const {
    currentUserId,
    currentUserIsAdmin,
    threading,
    isSaving,
    isDeleting,
    isReplying,
    onSaveEdit,
    onConfirmDelete,
    onSubmitReply,
  } = props
  const isAuthor = Boolean(currentUserId && comment.userId === currentUserId)
  const isTopLevel = comment.parentCommentId === null
  const canReply = threading && isTopLevel && Boolean(currentUserId)
  const replyCount = isTopLevel
    ? props.comments.filter((c) => c.parentCommentId === comment.id).length
    : undefined
  return (
    <CommentThreadItem
      key={comment.id}
      comment={comment}
      canEdit={isAuthor}
      canDelete={isAuthor || Boolean(currentUserIsAdmin)}
      canReply={canReply}
      isSaving={isSaving}
      isDeleting={isDeleting}
      isReplying={isReplying}
      replyCount={replyCount}
      onSaveEdit={onSaveEdit}
      onConfirmDelete={onConfirmDelete}
      onSubmitReply={onSubmitReply}
    >
      {children}
    </CommentThreadItem>
  )
}

function CommentList(props: CommentListProps): ReactElement {
  const { comments, threading } = props
  if (!threading) {
    return <ul className="grid gap-2">{comments.map((c) => renderItem(c, props))}</ul>
  }
  const topLevel = comments.filter((c) => c.parentCommentId === null)
  return (
    <ul className="grid gap-2">
      {topLevel.map((parent) => {
        const replies = comments.filter((c) => c.parentCommentId === parent.id)
        const nested =
          replies.length > 0 ? <>{replies.map((reply) => renderItem(reply, props))}</> : undefined
        return renderItem(parent, props, nested)
      })}
    </ul>
  )
}

export default function CommentThreadIsland(props: CommentThreadIslandProps): ReactElement {
  const {
    tableName,
    recordId,
    limit,
    paginationStyle,
    placeholder,
    emptyText,
    currentUserId,
    currentUserIsAdmin,
    threading,
    id,
    'data-testid': testId,
  } = props
  const threadingEnabled = threading === true
  const queryClient = useQueryClient()
  const [sort, setSort] = useState<'newest' | 'oldest'>(props.sort)
  const [offset, setOffset] = useState(0)
  const [loadedComments, setLoadedComments] = useState<CommentsListResponse['comments']>([])

  const listQuery = useQuery<CommentsListResponse>({
    queryKey: ['comments', tableName, recordId, sort, offset, limit],
    queryFn: async () => {
      const url = buildListUrl({ tableName, recordId, limit, offset, sort })
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) {
        return { comments: [], pagination: { total: 0, limit, offset, hasMore: false } }
      }
      const json = (await response.json()) as CommentsListResponse
      if (paginationStyle === 'loadMore') {
        setLoadedComments((prev) => (offset === 0 ? json.comments : [...prev, ...json.comments]))
      } else {
        setLoadedComments(json.comments)
      }
      return json
    },
    staleTime: 5000,
  })

  const invalidateAll = (): void => {
    queryClient.invalidateQueries({ queryKey: ['comments', tableName, recordId] })
    queryClient.invalidateQueries({ queryKey: ['comment-count', tableName, recordId] })
  }

  const createMutation = useMutation({
    mutationFn: (content: string) => postComment({ tableName, recordId, content }),
    onSuccess: () => {
      setOffset(0)
      setLoadedComments([])
      invalidateAll()
    },
  })

  const editMutation = useMutation({
    mutationFn: (input: { readonly commentId: string; readonly content: string }) =>
      patchComment({ tableName, recordId, commentId: input.commentId, content: input.content }),
    onSuccess: () => invalidateAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteCommentApi({ tableName, recordId, commentId }),
    onSuccess: () => invalidateAll(),
  })

  const replyMutation = useMutation({
    mutationFn: (input: { readonly parentCommentId: string; readonly content: string }) =>
      postComment({
        tableName,
        recordId,
        content: input.content,
        parentCommentId: input.parentCommentId,
      }),
    onSuccess: () => {
      setOffset(0)
      setLoadedComments([])
      invalidateAll()
    },
  })

  const visible = paginationStyle === 'loadMore' ? loadedComments : (listQuery.data?.comments ?? [])
  const pagination = listQuery.data?.pagination

  return (
    <section
      id={id}
      data-component="comments"
      data-component-type="comments"
      data-comments-limit={String(limit)}
      data-comments-sort={sort}
      data-comments-pagination-style={paginationStyle}
      data-comments-table={tableName}
      data-comments-record-id={recordId}
      data-comments-threading={String(threadingEnabled)}
      data-testid={testId}
      aria-label="Comments"
      className={`comments ${computeCommentThreadClasses()}`}
    >
      <div className="mb-2 flex items-center">
        <SortDropdown
          sort={sort}
          onChange={(next) => {
            setSort(next)
            setOffset(0)
            setLoadedComments([])
          }}
        />
      </div>
      {visible.length === 0 ? (
        <p
          data-comments-empty-state=""
          className="text-muted-foreground text-sm"
        >
          {emptyText}
        </p>
      ) : (
        <CommentList
          comments={visible}
          currentUserId={currentUserId}
          currentUserIsAdmin={currentUserIsAdmin}
          threading={threadingEnabled}
          isSaving={editMutation.isPending}
          isDeleting={deleteMutation.isPending}
          isReplying={replyMutation.isPending}
          onSaveEdit={(commentId, content) =>
            editMutation.mutateAsync({ commentId, content }).then(() => undefined)
          }
          onConfirmDelete={(commentId) =>
            deleteMutation.mutateAsync(commentId).then(() => undefined)
          }
          onSubmitReply={(parentCommentId, content) =>
            replyMutation.mutateAsync({ parentCommentId, content }).then(() => undefined)
          }
        />
      )}
      {paginationStyle === 'loadMore' && pagination && (
        <div className="mt-3">
          <LoadMoreButton
            hasMore={pagination.hasMore}
            isLoading={listQuery.isFetching}
            onClick={() => setOffset(offset + limit)}
          />
        </div>
      )}
      {paginationStyle === 'numbered' && pagination && (
        <div className="mt-3">
          <NumberedPagination
            total={pagination.total}
            limit={pagination.limit}
            offset={pagination.offset}
            onSelect={setOffset}
          />
        </div>
      )}
      {currentUserId ? (
        <CommentThreadForm
          placeholder={placeholder}
          isSubmitting={createMutation.isPending}
          onSubmit={(content) => createMutation.mutateAsync(content).then(() => undefined)}
        />
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">
          <a
            href="/sign-in"
            className="underline"
          >
            Sign in to comment
          </a>
        </p>
      )}
    </section>
  )
}
