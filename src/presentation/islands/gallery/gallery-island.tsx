/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { hasDataBinding, resolveIslandRecords } from '../runtime/data-binding'
import { GalleryCarousel } from './gallery-carousel'
import { GalleryGrid } from './gallery-grid'
import { GalleryPager } from './gallery-pager'
import { GalleryEmpty, GalleryError, GalleryLoading, GalleryMissingTable } from './gallery-states'
import { LoadMoreButton } from './load-more-button'
import { useGalleryRecords } from './use-gallery-records'
import type { TableRecord } from '../runtime/types'
import type {
  GalleryCard,
  GalleryGridColumns,
} from '@/domain/models/app/pages/components/component-types/data/gallery'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { ReactElement } from 'react'

interface PaginationConfig {
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

interface GalleryIslandProps {
  readonly dataSource?: {
    /** DB-table binding — ABSENT for a system-source binding. */
    readonly table?: string
    /**
     * System read-endpoint binding (CAP-1). Renders cards from a named read
     * endpoint instead of a declared DB table. Mutually exclusive with `table`.
     */
    readonly system?: SystemSource
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    readonly pagination?: PaginationConfig
  }
  /**
   * Rows supplied by an EMBEDDING component instead of fetched here — the
   * data-table's view switcher renders this island over the rows its grid is
   * already showing, so a runtime search / filter carries across the switch.
   * Passed WITHOUT a `dataSource`, which disables the fetch; it also stands in
   * for the data binding, since the embedder already resolved one.
   */
  readonly records?: readonly TableRecord[]
  readonly gridColumns?: GalleryGridColumns
  readonly galleryCard?: GalleryCard
  readonly emptyMessage?: string
  readonly layout?: 'grid' | 'masonry' | 'carousel'
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
function computePaginationView(
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

/**
 * Build the Load More click handler. Returning the function from a separate
 * builder keeps the `onClick` JSX prop as a plain reference (rather than an
 * inline arrow that the react-perf rule would flag).
 */
function buildLoadMoreHandler(setPage: (updater: (prev: number) => number) => void): () => void {
  return () => setPage((prev) => prev + 1)
}

/**
 * Renders the populated gallery (records + whichever paging control the
 * declared style asks for). Pulled out of `GalleryIsland` so the parent stays
 * under the cyclomatic-complexity cap — this component only deals with the "we
 * have records" branch.
 */
function GalleryContent({
  records,
  pageSize,
  paginationStyle,
  galleryCard,
  gridColumns,
  layout,
}: {
  readonly records: readonly TableRecord[]
  readonly pageSize: number | undefined
  readonly paginationStyle: PaginationConfig['style'] | undefined
  readonly galleryCard: GalleryCard | undefined
  readonly gridColumns: GalleryGridColumns | undefined
  readonly layout: 'grid' | 'masonry' | 'carousel' | undefined
}): ReactElement {
  // One 1-based cursor serves both controls: `loadMore` reads it as "how many
  // pages have been revealed", the numbered pager as "which page is drawn". The
  // setter goes to the pager as-is — it is referentially stable, which a fresh
  // arrow per render would not be.
  const [page, setPage] = useState<number>(1)
  const { visibleRecords, showLoadMore, showPager, pageCount, currentPage } = computePaginationView(
    records,
    page,
    pageSize,
    paginationStyle
  )
  const onLoadMore = buildLoadMoreHandler(setPage)

  // A carousel is the same cards on a walkable track rather than a wrapped
  // shell, so it owns its own container and controls; the responsive column
  // arithmetic the grid does describes an arrangement it does not have. Paging
  // is unchanged — a load-more still appends to the track.
  return (
    <>
      {layout === 'carousel' ? (
        <GalleryCarousel
          records={visibleRecords}
          card={galleryCard}
        />
      ) : (
        <GalleryGrid
          records={visibleRecords}
          card={galleryCard}
          gridColumns={gridColumns}
          layout={layout}
        />
      )}
      {showLoadMore && <LoadMoreButton onClick={onLoadMore} />}
      {showPager && (
        <GalleryPager
          pageCount={pageCount}
          currentPage={currentPage}
          onSelect={setPage}
        />
      )}
    </>
  )
}

export default function GalleryIsland({
  dataSource,
  records: embeddedRecords,
  gridColumns,
  galleryCard,
  emptyMessage,
  layout,
}: GalleryIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useGalleryRecords(dataSource)

  // A binding is required: either a DB table, a system read endpoint, or rows
  // handed in by an embedder that already resolved one of the two.
  if (!embeddedRecords && !hasDataBinding(dataSource)) return <GalleryMissingTable />
  if (isLoading) return <GalleryLoading />
  if (isError) return <GalleryError error={error} />

  const records = resolveIslandRecords(embeddedRecords, data?.records)
  if (records.length === 0) return <GalleryEmpty message={emptyMessage} />
  const pagination = dataSource?.pagination

  return (
    <GalleryContent
      records={records}
      pageSize={pagination?.pageSize}
      paginationStyle={pagination?.style}
      galleryCard={galleryCard}
      gridColumns={gridColumns}
      layout={layout}
    />
  )
}
