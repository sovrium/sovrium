/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext } from 'react'
import type { GalleryPartClasses } from '@/presentation/design/gallery-part-classes'

/**
 * The gallery's piece classes, the author's parts already merged on the server
 * (`galleryClasses` in the payload). Absent, each piece draws its recipe.
 */
export const GalleryClassesContext = createContext<GalleryPartClasses | undefined>(undefined)

/** Publishes the card a reader selects, on a gallery that declares `publishes`. */
export const GallerySelectionContext = createContext<((recordId: unknown) => void) | undefined>(
  undefined
)

/**
 * The reader's own rows a gallery joins onto its cards (`dataSource.mine`), as
 * the server read them (`_viewerRows`), and how a card's toggle records a
 * switch: the row it created, or `null` once deleted.
 */
export interface GalleryViewerRows {
  readonly as: string
  readonly table: string
  readonly link: string
  readonly user: string
  readonly userId: string
  readonly rows: Readonly<Record<string, unknown>>
  readonly setRow: (item: string, row: unknown) => void
}

export const GalleryViewerRowsContext = createContext<GalleryViewerRows | undefined>(undefined)
