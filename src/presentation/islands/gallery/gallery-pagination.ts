/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** What a gallery draws of its records, and which control reaches the rest. */

import type { TableRecord } from '../runtime/types'

export interface PaginationConfig {
  /**
   * The most cards the grid may DRAW at once — a display gate over the set the
   * island has already fetched, not a request size. The fetch asks for one
   * large page (`useGalleryRecords`) and the slice happens here.
   */
  readonly pageSize: number
  /**
   * How the reader reaches the records past the first page — carried from
   * `dataSource.pagination.style`, and OMITTED means `numbered` (the default
   * the schema states, never "no control": a `pageSize` that narrows the grid
   * with nothing to page by would put bound records out of reach).
   *
   * `infinite` is accepted by the schema and deliberately NOT implemented:
   * scroll-triggered paging needs a sentinel row, an intersection observer and
   * a re-entrancy guard, and none of that can ship until something specifies
   * how it behaves at the end of the set. The same refusal is written on the
   * list's `loadMore` prop (`../list/list-island.tsx`) and on
   * `PaginationStyleSchema`, which the published JSON Schema carries. A gallery
   * declaring it therefore pages exactly as `numbered` does — the refusal costs
   * the reader a nicer interaction, never a record.
   */
  readonly style?: 'loadMore' | 'numbered' | 'infinite'
}

interface PaginationView {
  readonly visibleRecords: readonly TableRecord[]
  readonly showLoadMore: boolean
  /**
   * The numbered pager should render. Decided HERE rather than re-derived at
   * the JSX, so "which control does this style get" is answered in exactly one
   * place and the two controls cannot both appear (or both vanish on the last
   * page of a `loadMore` gallery, which a `!showLoadMore` guard would do).
   */
  readonly showPager: boolean
  /** How many pages the bound set spans — `1` when there is nothing to page. */
  readonly pageCount: number
  /** The 1-based page actually drawn, clamped into `pageCount`. */
  readonly currentPage: number
}

/**
 * Compute what the grid draws, and which control gets the reader to the rest.
 *
 * Every style pages: the choice decides the CONTROL, never whether the records
 * past the first page are reachable. `loadMore` grows the slice from the top;
 * `numbered` — and `infinite`, which falls back to it — moves a window of
 * `pageSize`. With no `pageSize` at all there is no window and no control:
 * paging is opt-in, and a gallery that was not asked to page draws everything.
 */
export function computePaginationView(
  records: readonly TableRecord[],
  page: number,
  pageSize: number | undefined,
  paginationStyle: PaginationConfig['style'] | undefined
): PaginationView {
  if (pageSize === undefined) {
    return {
      visibleRecords: records,
      showLoadMore: false,
      showPager: false,
      pageCount: 1,
      currentPage: 1,
    }
  }
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize))
  const currentPage = Math.min(page, pageCount)

  if (paginationStyle === 'loadMore') {
    const sliceCount = Math.min(page * pageSize, records.length)
    return {
      visibleRecords: records.slice(0, sliceCount),
      showLoadMore: sliceCount < records.length,
      showPager: false,
      pageCount,
      currentPage,
    }
  }

  const start = (currentPage - 1) * pageSize
  return {
    visibleRecords: records.slice(start, start + pageSize),
    showLoadMore: false,
    // A single page offers nowhere to go, and a pager promising that is noise —
    // the same call the SSR list pager makes at `totalPages <= 1`.
    showPager: pageCount > 1,
    pageCount,
    currentPage,
  }
}
