/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines-per-function, complexity, react-perf/jsx-no-new-function-as-prop -- comment-thread-island composes 6 conditional UI states (loading, error, empty, list, form, pagination) into a single component; per-handler arrow props are conventional React pattern. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  computeCommentActionClasses,
  computeCommentEmptyClasses,
  computeCommentPagerClasses,
  computeCommentSignedOutClasses,
  computeCommentSortBarClasses,
} from '@/presentation/design/comments-default-classes'
import { buildListUrl, deleteCommentApi, patchComment, postComment } from './comment-thread-api'
import { NumberedPagination, SortDropdown } from './comment-thread-controls'
import { CommentThreadForm } from './comment-thread-form'
import { CommentList } from './comment-thread-list'
import { useScrollFetch } from './use-scroll-fetch'
import type { CommentsListResponse, CommentThreadIslandProps } from './comment-thread-types'

/**
 * Comment-thread island.
 *
 * Hydrates the SSR `<section data-component="comments">` placeholder with:
 * - paged comment list (TanStack Query)
 * - authenticated comment form (POST /comments)
 * - per-comment edit / delete (PATCH / DELETE) by author or admin
 * - scroll-fetched pages OR numbered pagination (per `paginationStyle`)
 * - sort dropdown (newest first / oldest first)
 *
 * Requires `tableName` AND `recordId` at SSR time — the placeholder only
 * emits the `data-island` marker when both are resolvable.
 *
 * Specs covered (subset): [internal ref] … 029.
 */

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
    'data-testid': testId,
  } = props
  const threadingEnabled = threading === true
  const queryClient = useQueryClient()
  const [sort, setSort] = useState<'newest' | 'oldest'>(props.sort)
  const [loadedComments, setLoadedComments] = useState<CommentsListResponse['comments']>([])
  const { offset, goToOffset, restart, sentinelRef } = useScrollFetch(limit)

  // Every reset of the list forgets the pages already asked for, or the first
  // scroll after a re-sort would be read as a page already served.
  const restartFromFirstPage = (): void => {
    restart()
    setLoadedComments([])
  }

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

  // THE BUSY STATE IS WRITTEN ON THE HOST, not only here. `island-client`
  // calls `createRoot(host)` on the SSR `<section data-component="comments">`,
  // so this subtree renders INSIDE it — and the host is the element a reader's
  // assistive technology has been given as the Comments region since first
  // paint. Announcing the wait on the inner section alone would announce it to
  // nobody. The host ships `aria-busy="false"`; this keeps it true.
  const rootRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    rootRef.current?.parentElement?.setAttribute('aria-busy', String(listQuery.isFetching))
  }, [listQuery.isFetching])

  const invalidateAll = (): void => {
    queryClient.invalidateQueries({ queryKey: ['comments', tableName, recordId] })
    queryClient.invalidateQueries({ queryKey: ['comment-count', tableName, recordId] })
  }

  const createMutation = useMutation({
    mutationFn: (content: string) => postComment({ tableName, recordId, content }),
    onSuccess: () => {
      restartFromFirstPage()
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
      restartFromFirstPage()
      invalidateAll()
    },
  })

  const visible = paginationStyle === 'loadMore' ? loadedComments : (listQuery.data?.comments ?? [])
  const pagination = listQuery.data?.pagination

  return (
    <section
      ref={rootRef}
      data-component="comments"
      data-component-type="comments"
      data-comments-limit={String(limit)}
      data-comments-sort={sort}
      data-comments-pagination-style={paginationStyle}
      data-comments-table={tableName}
      data-comments-record-id={recordId}
      data-comments-threading={String(threadingEnabled)}
      data-testid={testId}
      // A reader who cannot see the scroll has no button left to hear. Taking
      // the control away obliges the thread to announce the fetch it now makes
      // on its own — and to say `"false"` at rest rather than nothing, so an
      // assistive technology reads a settled region rather than an unknown one.
      // (React renders an `aria-*` boolean as the string `"true"`/`"false"`,
      // so the attribute is always present rather than dropped when false.)
      aria-busy={listQuery.isFetching}
      // FRAMELESS on purpose. `island-client.tsx` calls `createRoot(host)`, so
      // this subtree renders INSIDE the SSR `<section>` that already carries the
      // thread frame — border, ground, radius and outer margin. Drawing the frame
      // here too would nest two identical borders once the island mounts, which is
      // the card-in-card the row layout exists to remove.
      //
      // AND UNNAMED, for the same reason. The host already carries the author's
      // `props.id`, so stamping it here too put the SAME id on two nested
      // elements the moment the island mounted — invalid, and worse than
      // cosmetic: `#thread` then matches twice, so a `#id` assertion passes
      // before hydration and fails after it. That is a race an author meets as
      // a flaky page rather than as a duplicate id, which is why the id stays
      // on the ONE element that exists whether or not this subtree ever mounts.
      //
      // The ACCESSIBLE NAME stays on that host too, and it stayed here by
      // oversight when the id moved. A named `<section>` is a landmark, so
      // naming both left a reader navigating by landmark hearing one name twice
      // with no way to tell which of the two nested regions held the thread —
      // and left a lookup by that name resolving to one element before
      // hydration and to two after it.
      className="comments flex flex-col"
    >
      <div className={computeCommentSortBarClasses()}>
        <SortDropdown
          sort={sort}
          onChange={(next) => {
            setSort(next)
            restartFromFirstPage()
          }}
        />
      </div>
      {visible.length === 0 ? (
        <p
          data-comments-empty-state=""
          className={computeCommentEmptyClasses()}
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
      {/*
        THE SENTINEL, and it is the whole of the `loadMore` pager now. Reaching
        the last row is the reader's request for the next page; there is no
        button, because pressing one to continue reading is the interruption
        row 50 removes.

        Rendered ONLY while there is more to fetch, so an exhausted thread has
        nothing left to observe — "the end of the list" and "stop asking" are
        one state rather than two that could disagree. It sits after the list
        and before the form, which is where the older end of the thread is.
      */}
      {paginationStyle === 'loadMore' && pagination?.hasMore === true && (
        <div
          ref={sentinelRef}
          data-comments-sentinel=""
          aria-hidden="true"
          className={computeCommentPagerClasses()}
        />
      )}
      {paginationStyle === 'numbered' && pagination && (
        <div className={computeCommentPagerClasses()}>
          <NumberedPagination
            total={pagination.total}
            limit={pagination.limit}
            offset={pagination.offset}
            onSelect={goToOffset}
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
        <p className={computeCommentSignedOutClasses()}>
          <a
            href="/sign-in"
            className={computeCommentActionClasses()}
          >
            Sign in to comment
          </a>
        </p>
      )}
    </section>
  )
}
