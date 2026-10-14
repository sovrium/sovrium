/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useInfiniteSentinel } from '../hooks/use-infinite-sentinel'
import { LoadMoreButton } from './load-more-button'
import type { ReactElement } from 'react'

interface InfiniteLoadMoreProps {
  readonly hasMore: boolean
  readonly isLoading: boolean
  readonly onLoadMore: () => void
  /** What the polite status says, e.g. "40 of 120 loaded". */
  readonly status: string
  /** The keyboard fallback's label. */
  readonly label: string
  readonly footerClassName: string
  readonly buttonClassName?: string
}

/**
 * The end of an infinite list (`pagination.style: infinite`): an end marker the
 * next page is fetched at as the reader scrolls to it, the Load more control a
 * keyboard reader reaches instead of scrolling, and one polite status saying how
 * many rows are loaded. Shared by the table grid, the gallery, the list and the
 * board, which all page through the same offset continuation.
 *
 * The status stays in the tree at the end of the list too, so its last change
 * ("120 of 120 loaded") is announced; the marker and the control leave once
 * every row is held.
 */
export function InfiniteLoadMore({
  hasMore,
  isLoading,
  onLoadMore,
  status,
  label,
  footerClassName,
  buttonClassName,
}: InfiniteLoadMoreProps): ReactElement {
  const sentinel = useInfiniteSentinel({ hasMore, isLoading, onLoadMore, loadedKey: status })
  return (
    <div data-infinite-scroll="">
      {hasMore && (
        <div
          ref={sentinel}
          data-infinite-sentinel=""
          aria-hidden="true"
          className="h-px w-full"
        />
      )}
      {hasMore && (
        <LoadMoreButton
          onClick={onLoadMore}
          isLoading={isLoading}
          label={label}
          footerClassName={footerClassName}
          {...(buttonClassName === undefined ? {} : { buttonClassName })}
        />
      )}
      <p
        role="status"
        aria-live="polite"
        data-infinite-status=""
        className="sr-only"
      >
        {status}
      </p>
    </div>
  )
}
