/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optBool } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const MarqueeTypeLiteral = Schema.Literal('marquee')

export const MarqueeDirectionSchema = Schema.Literal('left', 'right', 'up', 'down').annotations({
  title: 'Marquee Direction',
  description: 'Direction the marquee content scrolls towards (default: left)',
})

export const MarqueeGapSchema = Schema.String.pipe(
  Schema.pattern(/^(0|\d+(\.\d+)?(px|rem|em|%))$/),
  Schema.annotations({
    title: 'Marquee Gap',
    description:
      'CSS length separating marquee items, e.g. "2rem" or "24px". Applied to the child GROUP, not the track: a gap on the track would make the 50% translate under-shoot by half a gap and stutter once per cycle.',
    examples: ['2rem', '24px', '0'],
  })
)

export const marqueeFields = {
  ...coreFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  marqueeDirection: Schema.optional(MarqueeDirectionSchema),
  marqueeSpeed: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        title: 'Marquee Speed',
        description:
          'Seconds for one full loop of the track. Larger is slower. Expressed in SECONDS (not milliseconds) because it maps straight onto the CSS animation-duration of a continuous loop.',
        examples: [20, 40],
      })
    )
  ),
  marqueeGap: Schema.optional(MarqueeGapSchema),
  pauseOnHover: optBool(
    'Pause the scroll while the pointer is over the marquee, and while any child holds keyboard focus (WCAG 2.2.2)'
  ),
  marqueeFade: optBool('Fade the leading and trailing edges of the band so items enter and leave'),
  pauseControl: optBool(
    'Render an explicit pause/resume button, so the motion can be stopped without a pointer'
  ),
} as const
