/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DurationSchema } from './hover-interaction'

/**
 * Page load animation types
 *
 * Animations played when page loads:
 * - fadeIn: Fade in smoothly
 * - fadeInUp: Fade in while moving up from below
 * - fadeInDown: Fade in while moving down from above
 * - zoomIn: Zoom in from small to normal size
 * - slideInUp: Slide up into position
 * - slideInDown: Slide down into position
 */
export const EntranceAnimationTypeSchema = Schema.Literal(
  'fadeIn',
  'fadeInUp',
  'fadeInDown',
  'zoomIn',
  'slideInUp',
  'slideInDown'
).annotations({
  description: 'Animation type for page load',
})

/**
 * Animation played when page loads
 *
 * Provides initial page load animations for components.
 * Useful for creating engaging entry experiences.
 *
 * Configuration options:
 * - animation: Animation type (required)
 * - delay: Delay before animation starts (default: '0ms')
 * - duration: Animation duration (default: '600ms')
 * - stagger: Delay between sibling animations (e.g., '50ms', '100ms')
 *
 * Stagger effect: When multiple sibling components have entrance animations,
 * stagger adds incremental delay to each sibling, creating a cascading effect.
 *
 * @example
 * ```typescript
 * const entrance = {
 *   animation: 'fadeInUp',
 *   delay: '200ms',
 *   duration: '800ms'
 * }
 *
 * const staggered = {
 *   animation: 'fadeIn',
 *   stagger: '100ms' // Each sibling animates 100ms after the previous
 * }
 * ```
 *
 * @see specs/app/pages/common/interactions/entrance-animation.schema.json
 */
export const EntranceAnimationSchema = Schema.Struct({
  animation: EntranceAnimationTypeSchema,
  delay: Schema.optional(
    DurationSchema.annotations({
      description: 'Delay before animation starts',
    })
  ),
  duration: Schema.optional(DurationSchema),
  stagger: Schema.optional(
    DurationSchema.annotations({
      description: 'Delay between sibling animations',
      examples: ['50ms', '100ms'],
    })
  ),
}).annotations({
  title: 'Entrance Animation',
  description: 'Animation played when page loads',
})

export type EntranceAnimationType = Schema.Schema.Type<typeof EntranceAnimationTypeSchema>
export type EntranceAnimation = Schema.Schema.Type<typeof EntranceAnimationSchema>
