/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  DurationSchema,
  EasingFunctionSchema,
} from '@/domain/models/app/pages/components/interactions/hover'

export const AnimationConfigObjectSchema = Schema.Struct({
  enabled: Schema.optional(Schema.Boolean),
  duration: Schema.optional(DurationSchema),
  easing: Schema.optional(EasingFunctionSchema),
  delay: Schema.optional(DurationSchema),
  keyframes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}).pipe(
  Schema.annotations({
    title: 'Animation Configuration Object',
    description: 'Detailed animation configuration',
  })
)

export const AnimationValueSchema = Schema.Union(
  Schema.Boolean,
  Schema.String,
  AnimationConfigObjectSchema
).pipe(
  Schema.annotations({
    title: 'Animation Value',
    description: 'Animation configuration (boolean, string, or object)',
  })
)

const DurationTokensSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Duration key must start with a letter and contain only alphanumeric characters',
    })
  ),
  value: DurationSchema,
})

const EasingTokensSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () => 'Easing key must start with a letter and contain only alphanumeric characters',
    })
  ),
  value: EasingFunctionSchema,
})

const KeyframesTokensSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Keyframe key must start with a letter and contain only alphanumeric characters',
    })
  ),
  value: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

export const AnimationsConfigSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Animation key must start with a letter and contain only alphanumeric characters',
    }),
    Schema.annotations({
      title: 'Animation Key',
      description: 'Animation name (alphanumeric)',
      examples: ['fadeIn', 'slideUp', 'modalOpen', 'duration', 'easing', 'keyframes'],
    })
  ),
  value: Schema.Union(
    AnimationValueSchema,
    DurationTokensSchema,
    EasingTokensSchema,
    KeyframesTokensSchema
  ),
}).pipe(
  Schema.annotations({
    title: 'Animation Configuration',
    description: 'Animation and transition design tokens',
  })
)

export type AnimationConfigObject = Schema.Schema.Type<typeof AnimationConfigObjectSchema>
export type AnimationValue = Schema.Schema.Type<typeof AnimationValueSchema>
export type AnimationsConfig = Schema.Schema.Type<typeof AnimationsConfigSchema>
