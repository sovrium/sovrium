/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTokenReference } from '@/infrastructure/css/theme/theme-token-resolver'
import type { Theme } from '@/domain/models/app/theme'
import type { AnimationConfigObject, AnimationsConfig } from '@/domain/models/app/theme/animations'

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

export function isReservedAnimationProperty(name: string): boolean {
  return name === 'duration' || name === 'easing' || name === 'keyframes'
}

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

export function processLegacyAnimationEntry(
  name: string,
  config: unknown,
  theme?: Theme
): readonly string[] {
  if (isReservedAnimationProperty(name)) return []
  if (typeof config === 'boolean' && !config) return []
  if (typeof config === 'boolean' && config) {
    const defaultKeyframes = { '0%': { opacity: '0' }, '100%': { opacity: '1' } }
    const keyframesCSS = generateKeyframes(name, defaultKeyframes, theme)
    const animationClass = generateAnimationClass(name)
    return [keyframesCSS, animationClass]
  }
  if (typeof config === 'string') {
    return [`.animate-${name} { animation: ${config}; }`]
  }
  if (typeof config === 'object' && config !== undefined) {
    return processAnimationConfigObject(name, config as AnimationConfigObject, theme)
  }
  return []
}

export function generateAnimationStyles(animations?: AnimationsConfig, theme?: Theme): string {
  if (!animations || Object.keys(animations).length === 0) return ''

  const keyframesTokens = animations.keyframes as
    Record<string, Record<string, unknown>> | undefined

  const nestedKeyframesCSS =
    keyframesTokens && typeof keyframesTokens === 'object'
      ? Object.entries(keyframesTokens).flatMap(([name, keyframes]) =>
          keyframes && typeof keyframes === 'object'
            ? [generateKeyframes(name, keyframes, theme)]
            : []
        )
      : []

  const legacyAnimationsCSS = Object.entries(animations).flatMap(([name, config]) =>
    processLegacyAnimationEntry(name, config, theme)
  )

  const animationCSS: readonly string[] = [...nestedKeyframesCSS, ...legacyAnimationsCSS]

  return animationCSS.join('\n')
}
