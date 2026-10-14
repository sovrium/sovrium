/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, type ReactElement } from 'react'
import { GalleryCardView } from './gallery-card'
import type { TableRecord } from '../runtime/types'
import type { GalleryCard } from '@/domain/models/app/pages/components/component-types/data/gallery'

/**
 * The carousel track, loaded only by a `carousel`: Embla is a library a grid
 * never needs, so it stays out of the gallery's own chunk.
 */
const CarouselTrack = lazy(() => import('../parts/carousel-primitives'))

/**
 * A `carousel`: the gallery's own cards, one slide each, on one walkable track.
 * Until the track has loaded, the cards are drawn as the same list without it.
 */
export function GalleryCarousel({
  records,
  card,
  table,
}: {
  readonly records: readonly TableRecord[]
  readonly card: GalleryCard | undefined
  readonly table?: string
}): ReactElement {
  const slides = records.map((record, index) => ({
    key: String(record['id'] ?? index),
    node: (
      <GalleryCardView
        record={record}
        card={card}
        table={table}
      />
    ),
  }))
  return (
    <Suspense
      fallback={
        <ul className="m-0 flex list-none gap-4 overflow-hidden p-0">
          {slides.map((slide) => (
            <li
              key={slide.key}
              className="flex w-72 shrink-0"
            >
              {slide.node}
            </li>
          ))}
        </ul>
      }
    >
      <CarouselTrack
        slides={slides}
        slideClassName="flex basis-72"
      />
    </Suspense>
  )
}
