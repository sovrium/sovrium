/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DurationSchema } from './hover'

/**
 * Scroll-triggered animation types
 *
 * Animations played when component enters viewport:
 * - fadeIn: Fade in smoothly
 * - fadeInUp: Fade in while moving up from below
 * - fadeInDown: Fade in while moving down from above
 * - fadeInLeft: Fade in while sliding from the left
 * - fadeInRight: Fade in while sliding from the right
 * - zoomIn: Zoom in from small to normal size
 * - slideInUp: Slide up into position
 * - slideInDown: Slide down into position
 */
export const ScrollAnimationSchema = Schema.Literals([
  'fadeIn',
  'fadeInUp',
  'fadeInDown',
  'fadeInLeft',
  'fadeInRight',
  'zoomIn',
  'slideInUp',
  'slideInDown',
]).annotate({
  description: 'Animation type triggered on scroll',
})

/**
 * Animations triggered when component enters viewport
 *
 * Uses Intersection Observer API to detect when component becomes visible.
 *
 * Configuration options:
 * - animation: Animation type (required)
 * - threshold: Percentage of element visible before triggering (0-1, default: 0.1)
 * - delay: Delay before animation starts (e.g., '100ms', '0.5s')
 * - duration: Animation duration (default: '600ms')
 * - once: Trigger animation only once (default: true)
 *
 * @example
 * ```typescript
 * const scrollAnimation = {
 *   animation: 'fadeInUp',
 *   threshold: 0.2,
 *   delay: '100ms',
 *   duration: '600ms',
 *   once: true
 * }
 *
 * const repeatAnimation = {
 *   animation: 'zoomIn',
 *   threshold: 0.5,
 *   once: false // Animate every time it enters viewport
 * }
 * ```
 *
 */
export const ScrollInteractionSchema = Schema.Struct({
  animation: ScrollAnimationSchema,
  threshold: Schema.optional(
    Schema.Finite.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 1 }))).annotate({
      description: 'Percentage of element visible before triggering (0-1)',
    })
  ),
  delay: Schema.optional(
    DurationSchema.annotate({
      description: 'Delay before animation starts',
      examples: ['0ms', '100ms', '0.5s'],
    })
  ),
  duration: Schema.optional(
    DurationSchema.annotate({ description: 'How long the scroll-triggered animation takes.' })
  ),
  once: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Trigger animation only once',
    })
  ),
}).annotate({
  title: 'Scroll Interaction',
  description: 'Animations triggered when component enters viewport',
})

/** @public */
export type ScrollAnimation = Schema.Schema.Type<typeof ScrollAnimationSchema>
/** @public */
export type ScrollInteraction = Schema.Schema.Type<typeof ScrollInteractionSchema>
