/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ViewTransitionSchema = Schema.Struct({
  type: Schema.Literal('fade', 'slide', 'none').pipe(
    Schema.annotations({
      description: 'Transition animation type: fade, slide, or none',
    })
  ),

  direction: Schema.optional(
    Schema.Literal('left', 'right', 'up', 'down').pipe(
      Schema.annotations({
        description: 'Slide direction (only for type: slide)',
      })
    )
  ),

  duration: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Animation duration in milliseconds',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ViewTransition',
    title: 'View Transition',
    description: 'Page navigation animation configuration',
  })
)

export type ViewTransition = Schema.Schema.Type<typeof ViewTransitionSchema>
