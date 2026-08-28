/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Transition configuration for page navigation animations.
 *
 * Defines how the page animates when navigating to/from it.
 *
 * @example
 * ```typescript
 * // Fade transition
 * viewTransition: { type: 'fade' }
 *
 * // Slide with direction
 * viewTransition: { type: 'slide', direction: 'left' }
 *
 * // Fade with custom duration
 * viewTransition: { type: 'fade', duration: 500 }
 *
 * // Disable transitions
 * viewTransition: { type: 'none' }
 * ```
 */
export const ViewTransitionSchema = Schema.Struct({
  /** Transition animation type */
  type: Schema.Literals(['fade', 'slide', 'none']).pipe(
    Schema.annotate({
      description: 'Transition animation type: fade, slide, or none',
    })
  ),

  /** Slide direction (only applicable when type is 'slide') */
  direction: Schema.optional(
    Schema.Literals(['left', 'right', 'up', 'down']).pipe(
      Schema.annotate({
        description: 'Slide direction (only for type: slide)',
      })
    )
  ),

  /** Animation duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Animation duration in milliseconds',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'ViewTransition',
    title: 'View Transition',
    description: 'Page navigation animation configuration',
  })
)

/** @public */
export type ViewTransition = Schema.Schema.Type<typeof ViewTransitionSchema>
