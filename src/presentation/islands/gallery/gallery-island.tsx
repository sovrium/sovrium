/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { useRecordSelectionToggle } from '../hooks/use-lazy-shared-filter-publisher'
import { withWeekdayDates, type WeekdayFields } from '../parts/weekday-dates'
import { hasDataBinding } from '../runtime/data-binding'
import { isRefusedRead } from '../runtime/records-api'
import { GalleryCarousel } from './carousel-layout'
import { GalleryCards, ViewerRowsScope } from './gallery-cards'
import { GalleryClassesContext, GallerySelectionContext } from './gallery-classes-context'
import { GalleryContinuation } from './gallery-continuation'
import { GalleryPager } from './gallery-pager'
import { computePaginationView, type PaginationConfig } from './gallery-pagination'
import { GalleryEmpty, GalleryError, GalleryLoading, GalleryMissingTable } from './gallery-states'
import { useGalleryRecords } from './use-gallery-records'
import { useViewerRows, type GalleryViewerRowsStamp } from './use-gallery-viewer-rows'
import type { SharedFilterPublisherConfig } from '../hooks/use-shared-filter-publisher'
import type { RecordGroupBy } from '../parts/grouped-records'
import type { TableRecord } from '../runtime/types'
import type {
  GalleryCard,
  GalleryGridColumns,
} from '@/domain/models/app/pages/components/component-types/data/gallery'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { GalleryPartClasses } from '@/presentation/design/gallery-part-classes'
import type { ReactElement } from 'react'

interface GalleryIslandProps {
  /** The gallery's own words in the page language, where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
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
  readonly gridColumns?: GalleryGridColumns
  readonly galleryCard?: GalleryCard
  readonly emptyMessage?: string
  readonly layout?: 'grid' | 'masonry' | 'carousel'
  readonly featured?: 'none' | 'first'
  /** The date fields that print their weekday, so a card reads them as the grid does. */
  readonly weekdays?: WeekdayFields
  /** The grid, card, cover and body classes, with the author's parts merged on the server. */
  readonly galleryClasses?: GalleryPartClasses
  /** The channel the gallery publishes the card a reader selects on. */
  readonly publishes?: SharedFilterPublisherConfig
  /** The bound view's grouping: the cards are drawn under a header per group. */
  readonly groupBy?: RecordGroupBy
  /** `dataSource.mine`: the reader's own rows, joined onto each card as `$record.<as>`. */
  readonly viewerRows?: GalleryViewerRowsStamp
}

/**
 * Build the Load More click handler. Returning the function from a separate
 * builder keeps the `onClick` JSX prop as a plain reference (rather than an
 * inline arrow that the react-perf rule would flag).
 */
function buildLoadMoreHandler(setPage: (updater: (prev: number) => number) => void): () => void {
  return () => setPage((prev) => prev + 1)
}

/** What the populated gallery draws from. */
type GalleryContentProps = Pick<
  GalleryIslandProps,
  'dataSource' | 'galleryCard' | 'gridColumns' | 'layout' | 'featured' | 'uiStrings' | 'groupBy'
> & { readonly records: readonly TableRecord[] }

/**
 * Renders the populated gallery (records + whichever paging control the
 * declared style asks for). Pulled out of `GalleryIsland` so the parent stays
 * under the cyclomatic-complexity cap — this component only deals with the "we
 * have records" branch.
 *
 * One 1-based cursor serves every control: `loadMore` and `infinite` read it as
 * "how many pages have been revealed", the numbered pager as "which page is
 * drawn". The setter goes to the pager as-is; it is referentially stable. A
 * carousel walks the same cards on a track: no column arithmetic, same paging.
 */
function GalleryContent({
  records,
  dataSource,
  galleryCard,
  gridColumns,
  layout,
  featured,
  uiStrings,
  groupBy,
}: GalleryContentProps): ReactElement {
  const pagination = dataSource?.pagination
  const [page, setPage] = useState<number>(1)
  const { visibleRecords, showLoadMore, showPager, pageCount, currentPage } = computePaginationView(
    records,
    page,
    pagination?.pageSize,
    pagination?.style
  )
  const onLoadMore = buildLoadMoreHandler(setPage)
  return (
    <>
      {layout === 'carousel' ? (
        <GalleryCarousel
          records={visibleRecords}
          card={galleryCard}
          table={dataSource?.table}
        />
      ) : (
        <GalleryCards
          groupBy={groupBy}
          uiStrings={uiStrings}
          records={visibleRecords}
          card={galleryCard}
          table={dataSource?.table}
          gridColumns={gridColumns}
          layout={layout}
          featured={featured}
        />
      )}
      <GalleryContinuation
        infinite={pagination?.style === 'infinite'}
        hasMore={showLoadMore}
        loaded={visibleRecords.length}
        total={records.length}
        onLoadMore={onLoadMore}
        words={uiStrings}
      />
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

/**
 * A failed read. A read the visitor may not make settles exactly as an empty
 * one: the gallery has nothing of that table to show, and a loading skeleton or
 * an error would each tell the visitor something about a table they may not see.
 */
function GalleryFailure({
  error,
  emptyMessage,
  strings,
}: {
  readonly error: unknown
  readonly emptyMessage: string | undefined
  readonly strings: GalleryIslandProps['uiStrings']
}): ReactElement {
  return isRefusedRead(error) ? (
    <GalleryEmpty {...{ message: emptyMessage, strings }} />
  ) : (
    <GalleryError {...{ error, strings }} />
  )
}

export default function GalleryIsland({
  dataSource,
  gridColumns,
  galleryCard,
  emptyMessage,
  layout,
  featured,
  weekdays,
  galleryClasses,
  publishes,
  uiStrings,
  viewerRows,
  groupBy,
}: GalleryIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useGalleryRecords(dataSource)
  const select = useRecordSelectionToggle(publishes)
  const own = useViewerRows(viewerRows)

  // A binding is required: either a DB table or a system read endpoint.
  if (!hasDataBinding(dataSource)) return <GalleryMissingTable strings={uiStrings} />
  if (isLoading) return <GalleryLoading strings={uiStrings} />
  if (isError) return <GalleryFailure {...{ error, emptyMessage, strings: uiStrings }} />

  const records = own.join(withWeekdayDates(data?.records ?? [], weekdays))
  if (records.length === 0)
    return <GalleryEmpty {...{ message: emptyMessage, strings: uiStrings }} />

  return (
    <GalleryClassesContext.Provider value={galleryClasses}>
      <GallerySelectionContext.Provider value={select}>
        <ViewerRowsScope control={own.control}>
          <GalleryContent
            records={records}
            dataSource={dataSource}
            galleryCard={galleryCard}
            gridColumns={gridColumns}
            layout={layout}
            featured={featured}
            uiStrings={uiStrings}
            groupBy={groupBy}
          />
        </ViewerRowsScope>
      </GallerySelectionContext.Provider>
    </GalleryClassesContext.Provider>
  )
}
