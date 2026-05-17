/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { GalleryGrid } from './gallery/gallery-grid'
import {
  GalleryEmpty,
  GalleryError,
  GalleryLoading,
  GalleryMissingTable,
} from './gallery/gallery-states'
import { LoadMoreButton } from './gallery/load-more-button'
import { useGalleryRecords } from './gallery/use-gallery-records'
import type { TableRecord } from './shared/types'
import type {
  GalleryCard,
  GalleryGridColumns,
} from '@/domain/models/app/pages/components/component-types/data/gallery'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

interface PaginationConfig {
  readonly pageSize: number
  readonly style?: 'loadMore' | 'numbered' | 'infinite'
}

interface GalleryIslandProps {
  readonly dataSource?: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
    readonly pagination?: PaginationConfig
  }
  readonly gridColumns?: GalleryGridColumns
  readonly galleryCard?: GalleryCard
  readonly emptyMessage?: string
  readonly layout?: 'grid' | 'masonry'
}

interface PaginationView {
  readonly visibleRecords: readonly TableRecord[]
  readonly showLoadMore: boolean
}

/** Compute the paginated slice + whether the Load More button should render. */
function computePaginationView(
  records: readonly TableRecord[],
  visibleCount: number,
  pageSize: number | undefined,
  paginationStyle: PaginationConfig['style'] | undefined
): PaginationView {
  if (pageSize === undefined) {
    return { visibleRecords: records, showLoadMore: false }
  }
  const sliceCount = Math.min(visibleCount || pageSize, records.length)
  return {
    visibleRecords: records.slice(0, sliceCount),
    showLoadMore: sliceCount < records.length && paginationStyle === 'loadMore',
  }
}

/**
 * Build the Load More click handler. Returning the function from a separate
 * builder keeps the `onClick` JSX prop as a plain reference (rather than an
 * inline arrow that the react-perf rule would flag).
 */
function buildLoadMoreHandler(
  pageSize: number | undefined,
  setVisibleCount: (updater: (prev: number) => number) => void
): () => void {
  return () => {
    if (pageSize === undefined) return
    setVisibleCount((prev) => (prev === 0 ? pageSize * 2 : prev + pageSize))
  }
}

/**
 * Renders the populated gallery (records + optional Load More button). Pulled
 * out of `GalleryIsland` so the parent stays under the cyclomatic-complexity
 * cap — this component only deals with the "we have records" branch.
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
  readonly layout: 'grid' | 'masonry' | undefined
}): ReactElement {
  const [visibleCount, setVisibleCount] = useState<number>(() => pageSize ?? 0)
  const { visibleRecords, showLoadMore } = computePaginationView(
    records,
    visibleCount,
    pageSize,
    paginationStyle
  )
  const onLoadMore = buildLoadMoreHandler(pageSize, setVisibleCount)

  return (
    <>
      <GalleryGrid
        records={visibleRecords}
        card={galleryCard}
        gridColumns={gridColumns}
        layout={layout}
      />
      {showLoadMore && <LoadMoreButton onClick={onLoadMore} />}
    </>
  )
}

export default function GalleryIsland({
  dataSource,
  gridColumns,
  galleryCard,
  emptyMessage,
  layout,
}: GalleryIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useGalleryRecords(dataSource)

  if (!dataSource?.table) return <GalleryMissingTable />
  if (isLoading) return <GalleryLoading />
  if (isError) return <GalleryError error={error} />

  const records = data?.records ?? []
  if (records.length === 0) return <GalleryEmpty message={emptyMessage} />

  return (
    <GalleryContent
      records={records}
      pageSize={dataSource.pagination?.pageSize}
      paginationStyle={dataSource.pagination?.style}
      galleryCard={galleryCard}
      gridColumns={gridColumns}
      layout={layout}
    />
  )
}
