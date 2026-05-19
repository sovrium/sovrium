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

export const GalleryPaginationStyleSchema = Schema.Literal(
  'loadMore',
  'numbered',
  'infinite'
).annotations({
  title: 'Gallery Pagination Style',
  description: 'Pagination interaction style for the gallery',
})

export type GalleryPaginationStyle = Schema.Schema.Type<typeof GalleryPaginationStyleSchema>


export const GalleryTypeLiteral = Schema.Literal('gallery')

export const galleryFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...dataBoundFields,
  gridColumns: Schema.optional(GalleryGridColumnsSchema),
  galleryCard: Schema.optional(GalleryCardSchema),
  layout: Schema.optional(
    Schema.Literal('grid', 'masonry').annotations({
      description: 'Gallery layout mode: grid | masonry',
    })
  ),
  emptyMessage: Schema.optional(
    Schema.String.annotations({
      description: 'Message displayed when no records match the data source query',
      examples: ['No products found', 'No items match your filters'],
    })
  ),
} as const


export { GalleryGridColumnsSchema, type GalleryGridColumns } from './grid-columns'
export { GalleryCardSchema, type GalleryCard } from './card'
