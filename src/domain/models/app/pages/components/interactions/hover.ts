/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const EasingFunctionSchema = Schema.Union(
  Schema.Literal('linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'),
  Schema.String.pipe(
    Schema.pattern(
      /^cubic-bezier\(\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*,\s*-?[\d.]+\s*\)$/,
      {
        message: () =>
          'Custom easing must be a cubic-bezier function with exactly 4 numeric values (e.g., cubic-bezier(0.4, 0, 0.2, 1))',
      }
    )
  ),
  Schema.String.pipe(
    Schema.pattern(
      /^steps\(\s*\d+\s*,\s*(start|end|jump-start|jump-end|jump-none|jump-both)\s*\)$/,
      {
        message: () =>
          'Steps function must have a number of steps and a position (e.g., steps(40, end))',
      }
    )
  )
).annotations({
  description: 'Transition timing function',
})

export const DurationSchema = Schema.String.pipe(
  Schema.pattern(/^[0-9]+(\.[0-9]+)?(ms|s)$/, {
    message: () => 'Duration must be a number followed by ms or s (e.g., 200ms, 0.5s)',
  })
)

export const HoverInteractionSchema = Schema.Struct({
  scale: Schema.optional(
    Schema.Number.annotations({
      description: 'Scale factor (e.g., 1.05 for 5% larger)',
      examples: [1.05, 1.1, 0.95],
    })
  ),
  transform: Schema.optional(
    Schema.String.annotations({
      description: 'CSS transform (scale, rotate, translate)',
      examples: ['scale(1.05)', 'translateY(-4px)', 'rotate(5deg)'],
    })
  ),
  opacity: Schema.optional(
    Schema.Number.pipe(Schema.between(0, 1)).annotations({
      description: 'Opacity value (0-1)',
    })
  ),
  backgroundColor: Schema.optional(
    Schema.String.annotations({
      description: 'Background color on hover',
    })
  ),
  color: Schema.optional(
    Schema.String.annotations({
      description: 'Text color on hover',
    })
  ),
  borderColor: Schema.optional(
    Schema.String.annotations({
      description: 'Border color on hover',
    })
  ),
  shadow: Schema.optional(
    Schema.String.annotations({
      description: 'Box shadow on hover',
      examples: ['0 10px 25px rgba(0,0,0,0.1)'],
    })
  ),
  duration: Schema.optional(DurationSchema),
  easing: Schema.optional(EasingFunctionSchema),
}).annotations({
  title: 'Hover Interaction',
  description: 'Visual changes when user hovers over component',
})

export type EasingFunction = Schema.Schema.Type<typeof EasingFunctionSchema>
export type Duration = Schema.Schema.Type<typeof DurationSchema>
export type HoverInteraction = Schema.Schema.Type<typeof HoverInteractionSchema>
