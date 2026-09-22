/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { computeGalleryGridClasses } from '@/presentation/design/gallery-default-classes'
import { GalleryCardView } from './gallery-card'
import { buildGridClasses, resolveActiveColumns } from './grid-class-builder'
import type { TableRecord } from '../runtime/types'
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

/**
 * Default viewport width to use during the first render (before the client has
 * a chance to read `window`). Matches Tailwind's `md` breakpoint so SSR-rendered
 * markup picks a reasonable middle-ground column count without flashing.
 */
const SSR_DEFAULT_VIEWPORT_WIDTH = 768

function getViewportWidth(): number {
  if (typeof window === 'undefined') return SSR_DEFAULT_VIEWPORT_WIDTH
  // documentElement.clientWidth excludes the vertical scrollbar, which is what
  // the CSS layout actually uses (and what Playwright reports). Matches the
  // semantics of Tailwind's responsive utilities.
  const doc = window.document?.documentElement
  return doc?.clientWidth ?? window.innerWidth ?? SSR_DEFAULT_VIEWPORT_WIDTH
}

/**
 * Renders the gallery records as a responsive CSS-grid card grid. Tracks the
 * viewport width via `resize` events so `data-columns` reflects the active
 * breakpoint at all times.
 */
export function GalleryGrid({
  records,
  card,
  gridColumns,
  layout,
}: GalleryGridProps): ReactElement {
  const [viewportWidth, setViewportWidth] = useState<number>(() => getViewportWidth())

  useEffect(() => {
    const onResize = () => setViewportWidth(getViewportWidth())
    // Read the actual viewport on mount — the SSR-default we used during the
    // first render may not match the real client viewport.
    setViewportWidth(getViewportWidth())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const resolvedLayout = layout ?? 'grid'
  const activeColumns = resolveActiveColumns(gridColumns, viewportWidth)
  const responsiveClasses = buildGridClasses(gridColumns)
  // Masonry approximates variable-height card rendering using CSS columns;
  // grid uses CSS-grid for equal-height aligned cells. Both shells (and the
  // canvas' 10px gutter they share) come from the recipe; only the responsive
  // `grid-cols-*` string stays here, because `buildGridClasses` spells all
  // thirty of its literals out for the scan-free compiler and the recipe
  // cannot know which of them a given `gridColumns` config resolved to.
  const layoutClasses =
    resolvedLayout === 'masonry'
      ? computeGalleryGridClasses({ layout: 'masonry' })
      : `${computeGalleryGridClasses()} ${responsiveClasses}`

  return (
    <div
      data-component="gallery"
      data-columns={String(activeColumns)}
      data-layout={resolvedLayout}
      // The component-scoped twin of `data-layout`. `data-layout` is a generic
      // name several views answer to; a page composing two of them needs to ask
      // for THIS view's arrangement without matching the other's.
      data-gallery-layout={resolvedLayout}
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
