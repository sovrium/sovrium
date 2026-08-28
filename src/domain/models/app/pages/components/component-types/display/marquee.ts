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

/**
 * Scroll direction of the marquee track.
 *
 * `left`/`right` scroll horizontally, `up`/`down` scroll vertically. The
 * renderer duplicates the child group once and translates the track by exactly
 * 50% along the axis, so the loop is seamless in either direction.
 */
export const MarqueeDirectionSchema = Schema.Literals(['left', 'right', 'up', 'down']).annotate({
  title: 'Marquee Direction',
  description: 'Direction the marquee content scrolls towards (default: left)',
})

/**
 * A CSS length accepted for the gap between marquee items.
 *
 * Deliberately restricted to a bare `0` or a number with a `px`/`rem`/`em`/`%`
 * unit. The value is interpolated into a CSS custom property by the renderer,
 * so an unconstrained string would be a CSS-injection surface (security rule
 * S3's spirit applied to style generation, not SQL).
 */
export const MarqueeGapSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^(0|\d+(\.\d+)?(px|rem|em|%))$/)),
  Schema.annotate({
    title: 'Marquee Gap',
    description:
      'CSS length separating marquee items, e.g. "2rem" or "24px". Applied to the child GROUP, not the track: a gap on the track would make the 50% translate under-shoot by half a gap and stutter once per cycle.',
    examples: ['2rem', '24px', '0'],
  })
)

/**
 * Marquee — a continuously scrolling band of child components.
 *
 * A container: its `children` are rendered once, then duplicated (the clone
 * marked `aria-hidden`) so the track can loop seamlessly. Unlike `entrance`
 * animations, a marquee never settles — its animation iterates infinitely,
 * which is exactly what makes WCAG 2.2.2 (Pause, Stop, Hide) apply. Provide
 * `pauseOnHover` and/or `pauseControl` so the motion can be stopped, and
 * expect the renderer to fall back to a statically laid-out, scrollable band
 * under `prefers-reduced-motion: reduce`.
 *
 * Every field below sits at the component TOP LEVEL (a sibling of `props`),
 * because `props` is an open record where any key validates. Renderers must
 * read `component.marqueeDirection`, never `elementProps.marqueeDirection`.
 */
export const marqueeFields = {
  ...coreFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  marqueeDirection: Schema.optional(MarqueeDirectionSchema),
  marqueeSpeed: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThan(0)),
      Schema.annotate({
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
