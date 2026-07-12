/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { hasDataBinding } from '../shared/data-binding'
import { GalleryGrid } from './gallery-grid'
import { GalleryEmpty, GalleryError, GalleryLoading, GalleryMissingTable } from './gallery-states'
import { LoadMoreButton } from './load-more-button'
import { useGalleryRecords } from './use-gallery-records'
import type { TableRecord } from '../shared/types'
import type {
  GalleryCard,
  GalleryGridColumns,
} from '@/domain/models/app/pages/components/component-types/data/gallery'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { ReactElement } from 'react'

interface PaginationConfig {
  readonly pageSize: number
  readonly style?: 'loadMore' | 'numbered' | 'infinite'
}

interface GalleryIslandProps {
  readonly dataSource?: {
    readonly table?: string
    readonly system?: SystemSource
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

function buildLoadMoreHandler(
  pageSize: number | undefined,
  setVisibleCount: (updater: (prev: number) => number) => void
): () => void {
  return () => {
    if (pageSize === undefined) return
    setVisibleCount((prev) => (prev === 0 ? pageSize * 2 : prev + pageSize))
  }
}

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

  if (!hasDataBinding(dataSource)) return <GalleryMissingTable />
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
