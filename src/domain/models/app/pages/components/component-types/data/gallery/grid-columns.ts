/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Responsive column configuration for gallery grid.
 */
export const GalleryGridColumnsSchema = Schema.Struct({
  mobile: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.lessThanOrEqualTo(6),
      Schema.annotations({ description: 'Number of columns on mobile (default: 1)' })
    )
  ),
  sm: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.lessThanOrEqualTo(6),
      Schema.annotations({ description: 'Number of columns on small screens (>= 640px)' })
    )
  ),
  md: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.lessThanOrEqualTo(6),
      Schema.annotations({ description: 'Number of columns on medium screens (>= 768px)' })
    )
  ),
  lg: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.lessThanOrEqualTo(6),
      Schema.annotations({ description: 'Number of columns on large screens (>= 1024px)' })
    )
  ),
  xl: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.lessThanOrEqualTo(6),
      Schema.annotations({ description: 'Number of columns on extra-large screens (>= 1280px)' })
    )
  ),
}).annotations({
  identifier: 'GalleryGridColumns',
  title: 'Gallery Grid Columns',
  description: 'Responsive column counts per breakpoint for the gallery grid layout',
})

/** @public */
export type GalleryGridColumns = Schema.Schema.Type<typeof GalleryGridColumnsSchema>
