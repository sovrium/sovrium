/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toKebabCase } from '@/presentation/utilities/string-utils'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Additional style properties to apply when composing animation
 */
interface AnimationStyleOptions {
  readonly animationPlayState?: string
  readonly animationFillMode?: string
  readonly opacity?: number
  readonly infinite?: boolean
}

/**
 * Configuration for composing animations
 */
interface AnimationComposerConfig {
  readonly baseStyle?: Record<string, unknown>
  readonly componentType?: string
  readonly animationName: string
  readonly theme?: Theme
  readonly defaultDuration: string
  readonly defaultEasing: string
  readonly options?: AnimationStyleOptions
}

/**
 * Animation timing configuration
 */
type AnimationTiming = {
  readonly duration: string
  readonly easing: string
}

/**
 * Extract animation timing from config
 */
function extractAnimationTiming(
  animationConfig: unknown,
  defaultDuration: string,
  defaultEasing: string
): AnimationTiming {
  const duration =
    typeof animationConfig === 'object' && animationConfig !== null && 'duration' in animationConfig
      ? (animationConfig.duration as string)
      : defaultDuration

  const easing =
    typeof animationConfig === 'object' && animationConfig !== null && 'easing' in animationConfig
      ? (animationConfig.easing as string)
      : defaultEasing

  return { duration, easing }
}

/**
 * Build animation style object
 */
function buildAnimationStyle(
  baseStyle: Record<string, unknown> | undefined,
  animationValue: string,
  options?: AnimationStyleOptions
): Record<string, unknown> {
  return {
    ...baseStyle,
    animation: animationValue,
    ...(options?.animationPlayState && { animationPlayState: options.animationPlayState }),
    ...(options?.animationFillMode && { animationFillMode: options.animationFillMode }),
    ...(options?.opacity !== undefined && { opacity: options.opacity }),
  }
}

/**
 * Compose animation style for a given component type
 *
 * Extracts animation configuration from theme and composes it with base style.
 * Follows functional programming principles: pure function, immutable operations.
 *
 * @param config - Configuration object for animation composition
 * @returns New style object with animation composed
 *
 * @example
 * ```typescript
 * const style = composeAnimation({
 *   baseStyle,
 *   componentType: 'toast',
 *   animationName: 'fadeOut',
 *   theme,
 *   defaultDuration: '300ms',
 *   defaultEasing: 'ease-out'
 * })
 * // Returns: { ...baseStyle, animation: 'fade-out 300ms ease-out' }
 * ```
 */
export function composeAnimation(config: AnimationComposerConfig): Record<string, unknown> {
  const animationConfig = config.theme?.animations?.[config.animationName]
  if (!animationConfig) {
    return config.baseStyle || {}
  }

  const { duration, easing } = extractAnimationTiming(
    animationConfig,
    config.defaultDuration,
    config.defaultEasing
  )
  const infiniteSuffix = config.options?.infinite ? ' infinite' : ''
  const animationValue = `${toKebabCase(config.animationName)} ${duration} ${easing}${infiniteSuffix}`

  return buildAnimationStyle(config.baseStyle, animationValue, config.options)
}
