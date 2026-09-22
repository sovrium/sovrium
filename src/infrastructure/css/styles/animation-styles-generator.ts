/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTokenReference } from '@/infrastructure/css/theme/theme-token-resolver'
import type { Design } from '@/domain/models/app/design'
import type { AnimationConfigObject, DesignMotion } from '@/domain/models/app/design/motion'

/**
 * Generate @keyframes CSS for a single animation
 * Supports token references like $colors.primary
 *
 * @param name - Animation name
 * @param keyframes - Keyframe steps definition
 * @param design - Optional design for token resolution
 * @returns CSS @keyframes rule as string
 *
 * @example
 * generateKeyframes('fade-in', { '0%': { opacity: 0 }, '100%': { opacity: 1 } })
 * // => '@keyframes fade-in {\n  0% { opacity: 0; }\n  100% { opacity: 1; }\n}'
 */
export function generateKeyframes(
  name: string,
  keyframes: Readonly<Record<string, unknown>>,
  design?: Design
): string {
  const keyframeSteps = Object.entries(keyframes)
    .map(([step, props]) => {
      const propsStr =
        typeof props === 'object' && props !== undefined
          ? Object.entries(props as Record<string, unknown>)
              .map(([prop, val]) => {
                const resolvedValue = resolveTokenReference(val, design)
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
 * Process animation config object
 * Returns array of CSS strings (keyframes + optional animation class)
 *
 * @param name - Animation name
 * @param animConfig - Animation configuration object
 * @param design - Optional design for token resolution
 * @returns Array of CSS rules (keyframes and optional animation class)
 */
export function processAnimationConfigObject(
  name: string,
  animConfig: AnimationConfigObject,
  design?: Design
): readonly string[] {
  if (!animConfig.keyframes) return []

  const keyframesCSS = generateKeyframes(name, animConfig.keyframes, design)

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
 * Process a single entry of `design.motion.animations`.
 *
 * An entry is `true | 'fade-in 1s ease' | {…}`. It used to share a record with
 * three RESERVED names — `duration`, `easing`, `keyframes` — which a guard here
 * had to skip while walking it. `motion` gives each of those its own member, so
 * the guard is gone and an animation may legitimately be CALLED `duration`;
 * keeping the skip would have silently dropped it.
 *
 * @param name - Animation name
 * @param config - Animation configuration (can be boolean, string, or object)
 * @param design - Optional design for token resolution
 * @returns Array of CSS rules (keyframes + optional animation class)
 */
export function processAnimationEntry(
  name: string,
  config: unknown,
  design?: Design
): readonly string[] {
  if (typeof config === 'boolean' && !config) return []
  if (typeof config === 'boolean' && config) {
    const defaultKeyframes = { '0%': { opacity: '0' }, '100%': { opacity: '1' } }
    const keyframesCSS = generateKeyframes(name, defaultKeyframes, design)
    const animationClass = generateAnimationClass(name)
    return [keyframesCSS, animationClass]
  }
  if (typeof config === 'string') {
    return [`.animate-${name} { animation: ${config}; }`]
  }
  if (typeof config === 'object' && config !== undefined) {
    return processAnimationConfigObject(name, config as AnimationConfigObject, design)
  }
  return []
}

/**
 * Generate `@keyframes` and animation CSS from `design.motion`.
 *
 * Two members reach this: `keyframes`, the named reusable blocks, and
 * `animations`, the compositions that spend a duration and a curve. They used
 * to be one record discriminated by value shape — see `processAnimationEntry`
 * for why that mattered.
 *
 * @param motion - The `design.motion` block
 * @param design - Optional design for token resolution
 * @returns Complete animation CSS as string
 */
export function generateMotionStyles(motion?: DesignMotion, design?: Design): string {
  if (!motion) return ''

  const namedKeyframesCSS = Object.entries(motion.keyframes ?? {}).flatMap(([name, keyframes]) =>
    keyframes && typeof keyframes === 'object' ? [generateKeyframes(name, keyframes, design)] : []
  )

  const animationsCSS = Object.entries(motion.animations ?? {}).flatMap(([name, config]) =>
    processAnimationEntry(name, config, design)
  )

  return [...namedKeyframesCSS, ...animationsCSS].join('\n')
}
