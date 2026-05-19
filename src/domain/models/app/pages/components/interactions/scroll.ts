/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DurationSchema } from './hover'

export const ScrollAnimationSchema = Schema.Literal(
  'fadeIn',
  'fadeInUp',
  'fadeInDown',
  'fadeInLeft',
  'fadeInRight',
  'zoomIn',
  'slideInUp',
  'slideInDown'
).annotations({
  description: 'Animation type triggered on scroll',
})

export const ScrollInteractionSchema = Schema.Struct({
  animation: ScrollAnimationSchema,
  threshold: Schema.optional(
    Schema.Number.pipe(Schema.between(0, 1)).annotations({
      description: 'Percentage of element visible before triggering (0-1)',
    })
  ),
  delay: Schema.optional(
    DurationSchema.annotations({
      description: 'Delay before animation starts',
      examples: ['0ms', '100ms', '0.5s'],
    })
  ),
  duration: Schema.optional(DurationSchema),
  once: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Trigger animation only once',
    })
  ),
}).annotations({
  title: 'Scroll Interaction',
  description: 'Animations triggered when component enters viewport',
})

export type ScrollAnimation = Schema.Schema.Type<typeof ScrollAnimationSchema>
export type ScrollInteraction = Schema.Schema.Type<typeof ScrollInteractionSchema>
