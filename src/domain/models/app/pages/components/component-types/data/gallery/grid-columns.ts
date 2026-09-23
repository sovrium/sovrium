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
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Number of columns on mobile (default: 1)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(6))
    )
  ),
  sm: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Number of columns on small screens (>= 640px)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(6))
    )
  ),
  md: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Number of columns on medium screens (>= 768px)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(6))
    )
  ),
  lg: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Number of columns on large screens (>= 1024px)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(6))
    )
  ),
  xl: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Number of columns on extra-large screens (>= 1280px)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(6))
    )
  ),
}).annotate({
  identifier: 'GalleryGridColumns',
  title: 'Gallery Grid Columns',
  description: 'Responsive column counts per breakpoint for the gallery grid layout',
})

/** @public */
export type GalleryGridColumns = Schema.Schema.Type<typeof GalleryGridColumnsSchema>
