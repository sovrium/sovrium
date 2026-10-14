/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeListLoadMoreClasses } from '@/presentation/design/list-default-classes'
import { InfiniteLoadMore } from '../parts/infinite-load-more'
import { LoadMoreButton } from '../parts/load-more-button'
import type { ReactElement } from 'react'

/** The list's load-more footer. Pure: resolved once, not per page loaded. */
const LIST_LOAD_MORE_CLASSES = computeListLoadMoreClasses()

/**
 * How a list reaches its next page: `button` draws a Load more control,
 * `infinite` the end-of-list sentinel with that control kept for the keyboard
 * and a polite count of the items loaded. Nothing once every item is drawn.
 */
export function ListContinuation({
  mode,
  hasMore,
  isLoading,
  loaded,
  total,
  onLoadMore,
}: {
  readonly mode: string | undefined
  readonly hasMore: boolean
  readonly isLoading: boolean
  readonly loaded: number
  readonly total: number
  readonly onLoadMore: () => void
}): ReactElement | undefined {
  if (mode === 'infinite') {
    return (
      <InfiniteLoadMore
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={onLoadMore}
        status={`${String(loaded)} of ${String(Math.max(total, loaded))} loaded`}
        label="Load More"
        footerClassName={LIST_LOAD_MORE_CLASSES}
      />
    )
  }
  if (mode !== 'button' || !hasMore) return undefined
  return (
    <LoadMoreButton
      onClick={onLoadMore}
      isLoading={isLoading}
      footerClassName={LIST_LOAD_MORE_CLASSES}
    />
  )
}
