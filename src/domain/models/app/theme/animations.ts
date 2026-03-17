/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  DurationSchema,
  EasingFunctionSchema,
} from '@/domain/models/app/page/common/interactions/hover-interaction'

/**
 * Animation configuration object
 *
 * Detailed animation config with duration, easing, delay, and keyframes.
 *
 * @example
 * ```typescript
 * const config = {
 *   enabled: true,
 *   duration: '300ms',
 *   easing: 'ease-in-out',
 *   delay: '0ms',
 * }
 * ```
 *
 * @see specs/app/theme/animations/animations.schema.json#/patternProperties/.../oneOf[2]
 */
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

/**
 * Animation value (boolean, string, or object)
 *
 * Flexible animation configuration:
 * - Boolean: Simple enable/disable (true/false)
 * - String: CSS animation value or class name
 * - Object: Detailed config (duration, easing, delay, keyframes)
 *
 * @example
 * ```typescript
 * const simple = true
 * const className = 'animate-fade-in'
 * const detailed = {
 *   enabled: true,
 *   duration: '300ms',
 *   easing: 'ease-in-out',
 * }
 * ```
 *
 * @see specs/app/theme/animations/animations.schema.json#/patternProperties/.../oneOf
 */
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

/**
 * Duration design tokens schema
 *
 * Map of duration token names to CSS duration values.
 *
 * @example
 * ```typescript
 * const durations = {
 *   fast: '200ms',
 *   normal: '300ms',
 *   slow: '500ms',
 * }
 * ```
 */
const DurationTokensSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Duration key must start with a letter and contain only alphanumeric characters',
    })
  ),
  value: DurationSchema,
})

/**
 * Easing function design tokens schema
 *
 * Map of easing token names to CSS easing functions.
 *
 * @example
 * ```typescript
 * const easings = {
 *   smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
 *   bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
 * }
 * ```
 */
const EasingTokensSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () => 'Easing key must start with a letter and contain only alphanumeric characters',
    })
  ),
  value: EasingFunctionSchema,
})

/**
 * Keyframes design tokens schema
 *
 * Map of keyframe animation names to CSS keyframe definitions.
 *
 * @example
 * ```typescript
 * const keyframes = {
 *   fadeIn: {
 *     from: { opacity: '0' },
 *     to: { opacity: '1' },
 *   },
 *   colorPulse: {
 *     '0%': { backgroundColor: '$colors.primary' },
 *     '50%': { backgroundColor: '$colors.accent' },
 *     '100%': { backgroundColor: '$colors.primary' },
 *   },
 * }
 * ```
 */
const KeyframesTokensSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z][a-zA-Z0-9]*$/, {
      message: () =>
        'Keyframe key must start with a letter and contain only alphanumeric characters',
    })
  ),
  value: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

/**
 * Animation configuration (animation and transition design tokens)
 *
 * Supports two formats:
 * 1. Nested design tokens (duration, easing, keyframes)
 * 2. Legacy flat animation names
 *
 * @example
 * ```typescript
 * // Nested design tokens
 * const animations = {
 *   duration: { fast: '200ms', normal: '300ms', slow: '500ms' },
 *   easing: { smooth: 'cubic-bezier(0.4, 0, 0.2, 1)', bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
 *   keyframes: {
 *     fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
 *     colorPulse: { '0%': { backgroundColor: '$colors.primary' }, '50%': { backgroundColor: '$colors.accent' }, '100%': { backgroundColor: '$colors.primary' } },
 *   },
 * }
 *
 * // Legacy flat animations
 * const animations = {
 *   fadeIn: true,
 *   slideUp: 'animate-slide-up',
 *   modalOpen: { enabled: true, duration: '300ms', easing: 'ease-in-out' },
 * }
 * ```
 *
 * @see specs/app/theme/animations/animations.schema.json
 */
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
