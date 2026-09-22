/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  GALLERY_CARD_BODY_CLASSES,
  GALLERY_COVER_FALLBACK_HEIGHT_CLASS,
  computeGalleryCardClasses,
  computeGalleryGridClasses,
} from '@/presentation/design/gallery-default-classes'
import type { ReactElement } from 'react'

export function GalleryMissingTable(): ReactElement {
  return (
    <div className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3">
      <p>
        Gallery is missing required <code>dataSource.table</code> configuration.
      </p>
      <p className="mt-1 opacity-80">Add it to this component in your app config, then redeploy.</p>
    </div>
  )
}

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
export function GalleryLoading(): ReactElement {
  return (
    <div
      className={`${computeGalleryGridClasses()} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}
      aria-label="Loading gallery..."
      role="status"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`gallery-loading-card-${String(i)}`}
          className={computeGalleryCardClasses()}
        >
          <div
            className={`bg-background-subtle w-full animate-pulse ${GALLERY_COVER_FALLBACK_HEIGHT_CLASS}`}
          />
          <div className={GALLERY_CARD_BODY_CLASSES}>
            <div className="bg-background-subtle h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-background-subtle h-3 w-1/2 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GalleryError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-3"
      role="alert"
    >
      <p>
        Failed to load gallery records: {error instanceof Error ? error.message : String(error)}
      </p>
      <p className="mt-1 opacity-80">Refresh the page to try again.</p>
    </div>
  )
}

export function GalleryEmpty({ message }: { readonly message: string | undefined }): ReactElement {
  return (
    <div
      className="border-border bg-background-subtle text-foreground-muted text-md rounded border p-6 text-center"
      data-component="gallery"
      data-empty="true"
    >
      <p>{message ?? 'No records yet.'}</p>
      {message === undefined && (
        <p className="mt-1 opacity-80">Records added to this table will appear here.</p>
      )}
    </div>
  )
}
