/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  GALLERY_CARD_BODY_CLASSES,
  GALLERY_CARD_SLOT_ATTRIBUTES,
  GALLERY_COVER_FALLBACK_HEIGHT_CLASS,
  computeGalleryCardClasses,
  computeGalleryGridClasses,
} from '@/presentation/design/gallery-default-classes'
import { ViewLoading, type ViewStrings } from '../parts/view-states'
import type { ReactElement } from 'react'

/**
 * The gallery's loading state.
 *
 * Grid and card chrome come from the SAME recipes the populated gallery uses,
 * so a card does not visibly re-draw at the moment the records arrive — the
 * pulsing bars are replaced inside a box whose border, radius, fill and gutter
 * never moved. The skeleton also mirrors the card's INTERNAL structure (a cover
 * band, then a padded body), which is what makes the swap a fill change rather
 * than a reflow.
 */
export function GalleryLoading({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewLoading
      className={`${computeGalleryGridClasses()} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}
      label={strings?.['gallery.loading'] ?? 'Loading gallery...'}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`gallery-loading-card-${String(i)}`}
          {...GALLERY_CARD_SLOT_ATTRIBUTES}
          className={computeGalleryCardClasses()}
        >
          <div
            data-slot="skeleton"
            className={`bg-muted w-full animate-pulse ${GALLERY_COVER_FALLBACK_HEIGHT_CLASS}`}
          />
          <div className={GALLERY_CARD_BODY_CLASSES}>
            <div
              data-slot="skeleton"
              className="bg-muted h-4 w-3/4 animate-pulse rounded-md"
            />
            <div
              data-slot="skeleton"
              className="bg-muted h-3 w-1/2 animate-pulse rounded-md"
            />
          </div>
        </div>
      ))}
    </ViewLoading>
  )
}
