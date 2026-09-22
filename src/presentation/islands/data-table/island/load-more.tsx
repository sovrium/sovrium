/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTablePagerClasses,
  computeTableToolbarButtonClasses,
} from '@/presentation/design/table-default-classes'

interface LoadMoreControlProps {
  /**
   * Whether the endpoint reported more rows behind the ones on screen. Derived
   * from the response's continuation token — the control renders NOTHING when
   * it is false, rather than rendering a disabled button, because at the end of
   * a feed there is nothing to offer and a greyed-out "Load more" reads as a
   * permission problem rather than as "you have it all".
   */
  readonly hasMore: boolean
  /** True while a continuation is already in flight. */
  readonly isLoading: boolean
  readonly onLoadMore: () => void
}

/**
 * The continuation affordance for a cursor-paginated feed.
 *
 * It replaces the page-number pager rather than sitting beside it: a cursor
 * envelope reports no total and cannot go back, so Previous/Next and "x of N"
 * have nothing truthful to say. What it can say is whether more rows follow,
 * which is the one question this button asks.
 *
 * Disabled — not hidden — while a continuation is in flight, so the control
 * stays where the reader left it and a second click cannot re-request the page
 * already being fetched. Its LABEL does not change while loading: the label is
 * the button's accessible name, and swapping it mid-flight would rename the
 * control out from under a screen reader (and out from under anything else that
 * addresses it by name) for the duration of a fetch. `aria-busy` carries the
 * in-flight state instead, which is what it is for.
 */
export function LoadMoreControl({ hasMore, isLoading, onLoadMore }: LoadMoreControlProps) {
  if (!hasMore) return undefined
  return (
    <div
      data-load-more
      // The same footer chrome the page-number pager wears — it stands in the
      // same place and answers the same question — with its single button
      // centred rather than the summary and steps pushed apart.
      className={`${computeTablePagerClasses({ position: 'bottom' })} justify-center`}
    >
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isLoading}
        aria-busy={isLoading}
        className={computeTableToolbarButtonClasses({ disabled: isLoading })}
      >
        Load more
      </button>
    </div>
  )
}
