/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { buildListUrl } from './comment-thread-api'
import { useCommentMutations } from './use-comment-mutations'
import { useScrollFetch } from './use-scroll-fetch'
import { useThreadFollow } from './use-thread-follow'
import { useMarkThreadRead } from './use-thread-read-state'
import type { CommentsListResponse, CommentThreadIslandProps } from './comment-thread-types'

type Sort = 'newest' | 'oldest'

/** One page of the thread, accumulated across pages when the thread scrolls. */
function useCommentPages(input: {
  readonly tableName: string
  readonly recordId: string
  readonly limit: number
  readonly paginationStyle: CommentThreadIslandProps['paginationStyle']
  readonly sort: Sort
  readonly offset: number
}) {
  const { tableName, recordId, limit, paginationStyle, sort, offset } = input
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
  const visible = paginationStyle === 'loadMore' ? loadedComments : (listQuery.data?.comments ?? [])
  const forget = (): void => setLoadedComments([])
  return { listQuery, visible, forget }
}

/**
 * THE BUSY STATE IS WRITTEN ON THE HOST, not only on the island's section.
 * `island-client` calls `createRoot(host)` on the SSR
 * `<section data-component="comments">`, so the island renders INSIDE it — and
 * the host is the element a reader's assistive technology has been given as
 * the Comments region since first paint. Announcing the wait on the inner
 * section alone would announce it to nobody. The host ships
 * `aria-busy="false"`; this keeps it true.
 */
function useHostBusy(isFetching: boolean) {
  const rootRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    rootRef.current?.parentElement?.setAttribute('aria-busy', String(isFetching))
  }, [isFetching])
  return rootRef
}

/**
 * Everything a comment thread KNOWS: its sort, the pages it has read, the
 * writes it can make, and the reads it keeps in step (read mark, live follow).
 * The island draws from this and holds no state of its own.
 */
export function useCommentThread(props: CommentThreadIslandProps) {
  const { tableName, recordId, limit, paginationStyle } = props
  const [sort, setSort] = useState<Sort>(props.sort)
  const { offset, goToOffset, restart, sentinelRef } = useScrollFetch(limit)
  const { listQuery, visible, forget } = useCommentPages({
    tableName,
    recordId,
    limit,
    paginationStyle,
    sort,
    offset,
  })

  // Every reset of the list forgets the pages already asked for, or the first
  // scroll after a re-sort would be read as a page already served.
  const restartFromFirstPage = (): void => {
    restart()
    forget()
  }
  const rootRef = useHostBusy(listQuery.isFetching)
  const mutations = useCommentMutations({ tableName, recordId, onListReset: restartFromFirstPage })
  useMarkThreadRead({ tableName, recordId, unreadCount: listQuery.data?.unreadCount })
  useThreadFollow({ tableName, recordId, refreshMode: props.refreshMode })

  const changeSort = (next: Sort): void => {
    setSort(next)
    restartFromFirstPage()
  }
  return {
    sort,
    changeSort,
    visible,
    pagination: listQuery.data?.pagination,
    isFetching: listQuery.isFetching,
    rootRef,
    mutations,
    goToOffset,
    sentinelRef,
  }
}

/** What {@link useCommentThread} answers, for the parts that draw it. */
export type CommentThreadState = ReturnType<typeof useCommentThread>
