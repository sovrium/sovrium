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
// A `GalleryPaginationStyleSchema` of its own stood here until 2026-09-14,
// carrying the same three members as that shared vocabulary one level down. It
// was exported, typed, and referenced by nothing — and the cost of that was
// never the dead bytes. A reader who found it took the gallery to be incapable
// of paging at all, and proposed adding a second, competing `pagination` key
// beside the one that already works. It is deleted rather than re-pointed, so
// the question resolves at the single place that answers it.

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
