/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { GalleryCardSchema } from './card'
import { GalleryGridColumnsSchema } from './grid-columns'

// A gallery declares its paging under `dataSource.pagination`
// (`{ pageSize, style }` — `PaginationStyleSchema` in `../../../data-source`),
// exactly as every other data-bound component does, and NOT as a key of its own.
//
// There is deliberately no gallery-specific pagination-style schema here. An
// unreferenced copy of the shared vocabulary would mislead a reader into taking
// the gallery to be incapable of paging, and into adding a second, competing
// `pagination` key beside the one that already works. The question resolves at
// the single place that answers it.

// ---------------------------------------------------------------------------
// Component type definition
// ---------------------------------------------------------------------------

export const GalleryTypeLiteral = Schema.Literal('gallery')

export const galleryFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...dataBoundFields,
  gridColumns: Schema.optional(GalleryGridColumnsSchema),
  galleryCard: Schema.optional(GalleryCardSchema),
  layout: Schema.optional(
    Schema.Literals(['grid', 'masonry', 'carousel']).annotate({
      description:
        'Gallery layout mode: grid | masonry | carousel. `carousel` lays the same cards on one horizontal track paged by its own controls, so a set too wide to grid is still walkable.',
    })
  ),
  /**
   * Lead the grid with one card drawn larger — the latest essay on a blog's
   * index, the flagship product of a shop.
   *
   * `first` spans the first card across two columns from the `md` breakpoint
   * up and sets its cover beside its text rather than above it; below `md`
   * it is an ordinary card. Grid layout only: a masonry or carousel track has
   * no column span to give.
   */
  featured: Schema.optional(
    Schema.Literals(['none', 'first']).annotate({
      description:
        "Lead the grid with a larger card: 'first' spans the first card across two columns from the md breakpoint up, its cover beside its text; 'none' (default) draws every card alike. Grid layout only.",
    })
  ),
  emptyMessage: Schema.optional(
    Schema.String.annotate({
      description: 'Message displayed when no records match the data source query',
      examples: ['No products found', 'No items match your filters'],
    })
  ),
} as const

// ---------------------------------------------------------------------------
// Re-export all sub-schemas
// ---------------------------------------------------------------------------
