/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The class list of each piece a gallery draws, the author's part classes
 * already merged over the recipe — `grid` (one string per layout), `card`,
 * `cover` (the box holding the image) and `body` (the block holding the card's
 * children). Resolved on the server and sent to the gallery island only when
 * the gallery names one of them.
 */
export interface GalleryPartClasses {
  readonly grid: string
  readonly masonry: string
  readonly card: string
  readonly cover: string
  readonly body: string
}
