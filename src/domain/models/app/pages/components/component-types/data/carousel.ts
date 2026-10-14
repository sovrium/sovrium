/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `carousel` — slides on one track, moved through one at a time with its own
 * controls or a swipe. shadcn/ui's Carousel, under its own name.
 *
 * ## A promotion, not a new control
 *
 * The track already ships: it is `gallery` with `layout: carousel`, the same
 * bound cards laid on one walkable track instead of a wrapped grid. This type is
 * that track without the key that selected it, so its keys are picked from
 * {@link galleryFields}: the binding (`dataSource`, `autoSave`, `search`), the
 * card template (`galleryCard`), the empty state, `responsive` and
 * `visibility`.
 *
 * Left out on purpose, because each only means something on a grid: `layout`
 * (a carousel is always one track), `gridColumns` and `featured` (both stay on
 * `type: gallery`). The reporter refuses each with a sentence naming where it
 * belongs.
 */

import { Schema } from 'effect'
import { galleryFields } from './gallery'

export const CarouselTypeLiteral = Schema.Literal('carousel')

export const carouselFields = {
  props: galleryFields.props,
  classes: galleryFields.classes,
  responsive: galleryFields.responsive,
  visibility: galleryFields.visibility,
  dataSource: galleryFields.dataSource,
  autoSave: galleryFields.autoSave,
  search: galleryFields.search,
  galleryCard: galleryFields.galleryCard,
  emptyMessage: galleryFields.emptyMessage,
} as const
