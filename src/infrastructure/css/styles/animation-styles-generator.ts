/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTokenReference } from '@/infrastructure/css/theme/theme-token-resolver'
import type { Theme } from '@/domain/models/app/theme'
import type { AnimationConfigObject, AnimationsConfig } from '@/domain/models/app/theme/animations'

/**
 * Generate @keyframes CSS for a single animation
 * Supports token references like $colors.primary
 *
 * @param name - Animation name
 * @param keyframes - Keyframe steps definition
 * @param theme - Optional theme for token resolution
 * @returns CSS @keyframes rule as string
 *
 * @example
 * generateKeyframes('fade-in', { '0%': { opacity: 0 }, '100%': { opacity: 1 } })
 * // => '@keyframes fade-in {\n  0% { opacity: 0; }\n  100% { opacity: 1; }\n}'
 */
export function generateKeyframes(
  name: string,
  keyframes: Record<string, unknown>,
  theme?: Theme
): string {
  const keyframeSteps = Object.entries(keyframes)
    .map(([step, props]) => {
      const propsStr =
        typeof props === 'object' && props !== undefined
          ? Object.entries(props as Record<string, unknown>)
              .map(([prop, val]) => {
                const resolvedValue = resolveTokenReference(val, theme)
                return `${prop}: ${resolvedValue};`
              })
              .join(' ')
          : ''
      return `  ${step} { ${propsStr} }`
    })
    .join('\n')

  return `@keyframes ${name} {\n${keyframeSteps}\n}`
}

/**
 * Generate animation shorthand CSS
 *
 * @param name - Animation name
 * @param duration - Optional duration (default: '300ms')
 * @param easing - Optional easing function (default: 'ease')
 * @param delay - Optional delay (default: '0ms')
 * @returns CSS animation class as string
 *
 * @example
 * generateAnimationClass('fade-in', '500ms', 'ease-in-out')
 * // => '.animate-fade-in { animation: fade-in 500ms ease-in-out 0ms; }'
 */
export function generateAnimationClass(
  name: string,
  duration?: string,
  easing?: string,
  delay?: string
): string {
  const dur = duration || '300ms'
  const ease = easing || 'ease'
  const del = delay || '0ms'
  return `.animate-${name} { animation: ${name} ${dur} ${ease} ${del}; }`
}

/**
 * Check if animation name is a reserved design token property
 *
 * @param name - Property name to check
 * @returns True if reserved, false otherwise
 */
export function isReservedAnimationProperty(name: string): boolean {
  return name === 'duration' || name === 'easing' || name === 'keyframes'
}

/**
 * Process animation config object
 * Returns array of CSS strings (keyframes + optional animation class)
 *
 * @param name - Animation name
 * @param animConfig - Animation configuration object
 * @param theme - Optional theme for token resolution
 * @returns Array of CSS rules (keyframes and optional animation class)
 */
export function processAnimationConfigObject(
  name: string,
  animConfig: AnimationConfigObject,
  theme?: Theme
): readonly string[] {
  if (!animConfig.keyframes) return []

  const keyframesCSS = generateKeyframes(name, animConfig.keyframes, theme)

  if (animConfig.enabled === false) {
    return [keyframesCSS]
  }

  const animationClass = generateAnimationClass(
    name,
    animConfig.duration,
    animConfig.easing,
    animConfig.delay
  )

  return [keyframesCSS, animationClass]
}

/**
 * Process a single legacy animation config entry
 * Returns array of CSS strings (keyframes + optional animation class)
 *
 * @param name - Animation name
 * @param config - Animation configuration (can be boolean, string, or object)
 * @param theme - Optional theme for token resolution
 * @returns Array of CSS rules
 */
export function processLegacyAnimationEntry(
  name: string,
  config: unknown,
  theme?: Theme
): readonly string[] {
  if (isReservedAnimationProperty(name)) return []
  if (typeof config === 'boolean' && !config) return []
  if (typeof config === 'string') return []
  if (typeof config === 'object' && config !== undefined) {
    return processAnimationConfigObject(name, config as AnimationConfigObject, theme)
  }
  return []
}

/**
 * Generate @keyframes and animation CSS from domain animations config
 * Supports both nested design tokens and legacy flat animations
 *
 * @param animations - Animations configuration from theme
 * @param theme - Optional theme for token resolution
 * @returns Complete animation CSS as string
 *
 * @example
 * generateAnimationStyles(theme.animations, theme)
 * // => '@keyframes fade-in { ... }\n.animate-fade-in { ... }'
 */
export function generateAnimationStyles(animations?: AnimationsConfig, theme?: Theme): string {
  if (!animations || Object.keys(animations).length === 0) return ''

  // Extract nested design tokens if present
  const keyframesTokens = animations.keyframes as
    | Record<string, Record<string, unknown>>
    | undefined

  // Generate keyframes from nested design tokens (immutable)
  const nestedKeyframesCSS =
    keyframesTokens && typeof keyframesTokens === 'object'
      ? Object.entries(keyframesTokens).flatMap(([name, keyframes]) =>
          keyframes && typeof keyframes === 'object'
            ? [generateKeyframes(name, keyframes, theme)]
            : []
        )
      : []

  // Process legacy flat animations (backwards compatibility, immutable)
  const legacyAnimationsCSS = Object.entries(animations).flatMap(([name, config]) =>
    processLegacyAnimationEntry(name, config, theme)
  )

  // Combine all CSS (immutable)
  const animationCSS: readonly string[] = [...nestedKeyframesCSS, ...legacyAnimationsCSS]

  return animationCSS.join('\n')
}
