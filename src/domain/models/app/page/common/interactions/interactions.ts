/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ClickInteractionSchema } from './click-interaction'
import { EntranceAnimationSchema } from './entrance-animation'
import { HoverInteractionSchema } from './hover-interaction'
import { ScrollInteractionSchema } from './scroll-interaction'

/**
 * Interactive behaviors triggered by user actions or page events
 *
 * Orchestrates four types of interactions (all optional):
 * - hover: Visual changes on mouse hover
 * - click: Actions triggered on click
 * - scroll: Animations when entering viewport
 * - entrance: Animations on page load
 *
 * Multiple interaction types can be combined on the same component.
 * Each interaction type works independently and doesn't interfere with others.
 *
 * @example
 * ```typescript
 * const interactions = {
 *   hover: {
 *     transform: 'scale(1.05)',
 *     duration: '200ms',
 *     easing: 'ease-out'
 *   },
 *   click: {
 *     animation: 'pulse',
 *     navigate: '/contact'
 *   },
 *   entrance: {
 *     animation: 'fadeInUp',
 *     delay: '100ms'
 *   }
 * }
 *
 * const hoverOnly = {
 *   hover: {
 *     backgroundColor: '#007bff',
 *     color: '#ffffff'
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/common/interactions/interactions.schema.json
 */
export const InteractionsSchema = Schema.Struct({
  hover: Schema.optional(HoverInteractionSchema),
  click: Schema.optional(ClickInteractionSchema),
  scroll: Schema.optional(ScrollInteractionSchema),
  entrance: Schema.optional(EntranceAnimationSchema),
}).annotations({
  title: 'Component Interactions',
  description: 'Interactive behaviors triggered by user actions or page events',
})

export type Interactions = Schema.Schema.Type<typeof InteractionsSchema>
