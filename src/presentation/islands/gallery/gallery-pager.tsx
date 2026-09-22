/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { computeGalleryPagerClasses } from '@/presentation/design/gallery-default-classes'
import type { ReactElement } from 'react'

// The footer string depends on nothing, so it is resolved once at module load
// rather than on every page the reader turns — the same treatment the list's
// load-more footer gives its own recipe.
const FOOTER_CLASSES = computeGalleryPagerClasses()

/**
 * One numbered chip.
 *
 * It is a component rather than a `<button>` inlined in the parent's `.map()`
 * for one reason: the click handler has to close over its own page number, and
 * an arrow written inside the map would allocate a new function per chip per
 * render (`react-perf/jsx-no-new-function-as-prop`). Owning the chip lets the
 * handler be a `useCallback` keyed on the two things it actually depends on.
 */
function GalleryPagerPage({
  page,
  current,
  onSelect,
}: {
  readonly page: number
  /** This chip is the page being drawn — it carries `aria-current="page"`. */
  readonly current: boolean
  readonly onSelect: (page: number) => void
}): ReactElement {
  const onClick = useCallback(() => onSelect(page), [onSelect, page])

  return (
    <button
      type="button"
      onClick={onClick}
      // Only the current chip carries it, so `[aria-current="page"]` inside this
      // nav resolves to exactly one element and reading it answers "which page
      // am I on" — for assistive tech and for a test alike.
      aria-current={current ? 'page' : undefined}
      className={computeGalleryPagerClasses({ part: 'page', current })}
    >
      {page}
    </button>
  )
}

/**
 * The gallery's numbered pager — the control that makes every bound record
 * reachable when `dataSource.pagination.pageSize` narrows what the grid draws.
 *
 * The grammar is the one the rest of the app already speaks: a
 * `<nav aria-label="pagination">` holding one `<button>` per page, the current
 * one marked `aria-current="page"`. That is the same shape as the SSR list
 * pager (`renderNumberedPaginationUI` in `special-components.tsx`) and as the
 * data-table's step pager, so a reader who has learned one pager has learned
 * this one. It is not the same CODE: an island may not import
 * `presentation/ui/**` (`[internal ref]` — client-side islands
 * reach domain types, other islands, utils and the RPC client, nothing else),
 * and the SSR pager is a static placeholder with no handlers and page 1 always
 * current. What IS shared is the part that carries the look —
 * `computeGalleryPagerClasses`, whose `'page'` chips the canvas drew for
 * exactly this control and which had no caller until now.
 *
 * Rendered only when there is more than one page: a single page of results
 * offers nowhere to go, and a pager promising that is noise. The SSR list pager
 * makes the same call (`totalPages <= 1` renders nothing).
 */
export function GalleryPager({
  pageCount,
  currentPage,
  onSelect,
}: {
  readonly pageCount: number
  readonly currentPage: number
  /**
   * Called with the 1-based page the reader asked for. The caller passes its
   * `useState` setter directly, which is referentially stable — a fresh arrow
   * here would re-render every chip on every keystroke elsewhere in the page.
   */
  readonly onSelect: (page: number) => void
}): ReactElement {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)

  return (
    <nav
      aria-label="pagination"
      className={FOOTER_CLASSES}
    >
      {pages.map((page) => (
        <GalleryPagerPage
          key={page}
          page={page}
          current={page === currentPage}
          onSelect={onSelect}
        />
      ))}
    </nav>
  )
}
