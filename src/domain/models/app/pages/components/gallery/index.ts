/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Gallery sub-schemas - re-exports from component-types/data/gallery/
 *
 * This file is a backward-compatibility barrel. The canonical definitions
 * now live in component-types/data/gallery/.
 */
export {
  GalleryGridColumnsSchema,
  type GalleryGridColumns,
} from '../component-types/data/gallery/grid-columns'

export { GalleryCardSchema, type GalleryCard } from '../component-types/data/gallery/card'

export {
  GalleryPaginationStyleSchema,
  type GalleryPaginationStyle,
} from '../component-types/data/gallery'
