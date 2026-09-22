/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   One carousel is mounted per gallery and its two controls close over the
   track ref; hoisting them would add indirection without removing render work,
   since scrolling the track re-renders nothing. */

import { useRef, type ReactElement } from 'react'
import { GalleryCardView } from './gallery-card'
import type { TableRecord } from '../runtime/types'
import type { GalleryCard } from '@/domain/models/app/pages/components/component-types/data/gallery'

/**
 * `layout: 'carousel'` — the same cards, laid on one walkable track.
 *
 * A carousel is a THIRD arrangement of the gallery's own cards, not a new
 * component: the binding, the card template and the empty state are all
 * `gallery`'s already. What it adds is that the track is walkable rather than
 * wrapped, which is why it is a layout literal instead of a type.
 *
 * Three rules it must keep, each of them a way carousels are commonly broken:
 *
 *  1. EVERY bound record is rendered. A track that drew only the visible slide
 *     would silently drop rows from a bound list, and a reader would have no
 *     way to know the set had been cut.
 *  2. It is a LIST. The cards are a collection whether they wrap or scroll, and
 *     a row of divs tells a screen reader neither how many there are nor where
 *     in them the reader is.
 *  3. It is reachable WITHOUT a pointer. Both controls are real buttons, so
 *     focusing one and pressing Enter walks the track — a track advanced only
 *     by clicking an arrow is the defect carousels are famous for.
 */

/** How far one press of a control walks the track, as a share of its width. */
const PAGE_FRACTION = 0.9

export function GalleryCarousel({
  records,
  card,
}: {
  readonly records: readonly TableRecord[]
  readonly card: GalleryCard | undefined
}): ReactElement {
  const track = useRef<HTMLUListElement>(null)

  const walk = (direction: -1 | 1): void => {
    const element = track.current
    if (element === null) return
    element.scrollBy({ left: direction * element.clientWidth * PAGE_FRACTION, behavior: 'smooth' })
  }

  return (
    <div
      data-component="gallery"
      data-layout="carousel"
      data-gallery-layout="carousel"
      className="relative w-full"
    >
      <ul
        ref={track}
        data-gallery-track=""
        className="m-0 flex w-full list-none gap-2.5 overflow-x-auto p-2"
      >
        {records.map((record) => (
          <li
            key={String(record['id'] ?? Math.random())}
            data-gallery-slide=""
            className="flex w-72 shrink-0"
          >
            <GalleryCardView
              record={record}
              card={card}
            />
          </li>
        ))}
      </ul>
      <TrackControls onWalk={walk} />
    </div>
  )
}

/** The paging strip under the track: one step back, one step forward. */
function TrackControls({ onWalk }: { readonly onWalk: (direction: -1 | 1) => void }): ReactElement {
  return (
    <div
      data-gallery-controls=""
      className="flex justify-end gap-2 px-2 pt-2"
    >
      <button
        type="button"
        aria-label="Previous"
        onClick={() => onWalk(-1)}
        className={CONTROL_CLASSES}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => onWalk(1)}
        className={CONTROL_CLASSES}
      >
        ›
      </button>
    </div>
  )
}

/**
 * The two track controls, drawn identically, in a strip of their own below it.
 *
 * Deliberately plain: the gallery's own surface tokens are what should read,
 * not a second button style.
 *
 * They used to be `absolute top-1/2` over the first and last card, which is the
 * arrangement most carousels ship and the one the 2026-09-16 review rejected:
 * each control was painted on top of two cards, hiding part of the content it
 * exists to page through. Overlaying chrome on content buys horizontal room the
 * track does not need — it already scrolls — at the cost of the content, so the
 * controls take a strip of their own and cover nothing.
 */
const CONTROL_CLASSES =
  'border-border bg-background text-foreground hover:bg-background-subtle flex h-8 w-8 shrink-0 items-center justify-center rounded-full border'
