/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { GalleryCardView } from './gallery-card'
import { buildGridClasses, resolveActiveColumns } from './grid-class-builder'
import type { TableRecord } from '../shared/types'
import type {
  GalleryCard,
  GalleryGridColumns,
} from '@/domain/models/app/pages/components/component-types/data/gallery'

interface GalleryGridProps {
  readonly records: readonly TableRecord[]
  readonly card: GalleryCard | undefined
  readonly gridColumns: GalleryGridColumns | undefined
  readonly layout?: 'grid' | 'masonry'
}

const SSR_DEFAULT_VIEWPORT_WIDTH = 768

function getViewportWidth(): number {
  if (typeof window === 'undefined') return SSR_DEFAULT_VIEWPORT_WIDTH
  const doc = window.document?.documentElement
  return doc?.clientWidth ?? window.innerWidth ?? SSR_DEFAULT_VIEWPORT_WIDTH
}

export function GalleryGrid({
  records,
  card,
  gridColumns,
  layout,
}: GalleryGridProps): ReactElement {
  const [viewportWidth, setViewportWidth] = useState<number>(() => getViewportWidth())

  useEffect(() => {
    const onResize = () => setViewportWidth(getViewportWidth())
    setViewportWidth(getViewportWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const activeColumns = resolveActiveColumns(gridColumns, viewportWidth)
  const responsiveClasses = buildGridClasses(gridColumns)
  const resolvedLayout = layout ?? 'grid'
  const layoutClasses =
    resolvedLayout === 'masonry'
      ? `columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 p-2`
      : `grid w-full gap-4 p-2 ${responsiveClasses}`

  return (
    <div
      data-component="gallery"
      data-columns={String(activeColumns)}
      data-layout={resolvedLayout}
      className={layoutClasses}
    >
      {records.map((record) => (
        <GalleryCardView
          key={String(record['id'] ?? Math.random())}
          record={record}
          card={card}
        />
      ))}
    </div>
  )
}
