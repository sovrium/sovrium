/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CarouselOrientationSchema } from '../../form-controls'
import { optBool } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const CarouselTypeLiteral = Schema.Literal('carousel')

export const carouselFields = {
  ...coreFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  carouselOrientation: Schema.optional(CarouselOrientationSchema),
  autoPlay: Schema.optional(
    Schema.Boolean.annotations({ description: 'Automatically advance slides' })
  ),
  autoPlayInterval: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Interval between auto-play transitions (ms)' })
    )
  ),
  loop: optBool('Loop slides continuously'),
  showDots: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show dot indicators below the carousel' })
  ),
  showArrows: Schema.optional(
    Schema.Boolean.annotations({ description: 'Show previous/next navigation arrows' })
  ),
} as const
