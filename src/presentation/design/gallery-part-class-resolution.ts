/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/design/class-merge'
import {
  GALLERY_CARD_BODY_CLASSES,
  computeGalleryCardClasses,
  computeGalleryGridClasses,
  computeGalleryImageClasses,
} from '@/presentation/design/gallery-default-classes'
import type { GalleryPartClasses } from '@/presentation/design/gallery-part-classes'

const GALLERY_PARTS = ['grid', 'card', 'cover', 'body'] as const

/**
 * The gallery's piece classes, recipe then the author's part (later wins), as
 * the island payload key `galleryClasses` — or nothing at all when the
 * gallery names no gallery part, so its payload keeps its bytes.
 *
 * @param parts - The author's classes by part (`design.components.gallery` under `classes`).
 */
export const declaredGalleryPartClasses = (
  parts: Readonly<Record<string, string>> | undefined
): { readonly galleryClasses?: GalleryPartClasses } => {
  if (parts === undefined || !GALLERY_PARTS.some((part) => parts[part] !== undefined)) return {}
  return {
    galleryClasses: {
      grid: cn(computeGalleryGridClasses(), parts['grid']),
      masonry: cn(computeGalleryGridClasses({ layout: 'masonry' }), parts['grid']),
      card: cn(computeGalleryCardClasses(), parts['card']),
      cover: cn(computeGalleryImageClasses(), parts['cover']),
      body: cn(GALLERY_CARD_BODY_CLASSES, parts['body']),
    },
  }
}
