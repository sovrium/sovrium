/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DurationSchema } from './hover'

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
