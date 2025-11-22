/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isCssProperty,
  normalizeStyleAnimations,
  parseStyle,
} from '@/presentation/styling/parse-style'
import { applyComponentAnimations } from './animation-composer-wrapper'
import { buildFlexClasses, buildGridClasses } from './class-builders'
import { getComponentShadow } from './shadow-resolver'
import type { Interactions } from '@/domain/models/app/page/common/interactions/interactions'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Extract CSS properties from props object
 * Separates CSS properties (e.g., maxWidth, backgroundColor) from other props
 *
 * @param props - Props object that may contain CSS properties
 * @returns Object with cssProps and remainingProps
 */
export function extractCssProperties(props: Record<string, unknown> | undefined): {
  readonly cssProps: Record<string, unknown>
  readonly remainingProps: Record<string, unknown>
} {
  if (!props) {
    return { cssProps: {}, remainingProps: {} }
  }

  // Use reduce for immutable accumulation
  return Object.entries(props).reduce<{
    readonly cssProps: Record<string, unknown>
    readonly remainingProps: Record<string, unknown>
  }>(
    (acc, [key, value]) => {
      if (isCssProperty(key)) {
        return {
          ...acc,
          cssProps: { ...acc.cssProps, [key]: value },
        }
      }
      return {
        ...acc,
        remainingProps: { ...acc.remainingProps, [key]: value },
      }
    },
    { cssProps: {}, remainingProps: {} }
  )
}

/**
 * Parse and normalize style object
 * Extracts CSS properties from the root of the props object and merges them with the style property
 */
export function parseComponentStyle(
  styleValue: unknown,
  props: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  // Parse the explicit style property
  const explicitStyle = styleValue
    ? normalizeStyleAnimations(
        typeof styleValue === 'string'
          ? parseStyle(styleValue)
          : (styleValue as Record<string, unknown>)
      )
    : undefined

  // Extract CSS properties from props (excluding the style property itself)
  const { cssProps } = extractCssProperties(props)

  // Remove the style property from cssProps if it exists (already handled above)
  const { style: _style, ...cssPropsWithoutStyle } = cssProps

  // Merge CSS properties with explicit style
  const mergedStyle = {
    ...cssPropsWithoutStyle,
    ...explicitStyle,
  }

  return Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined
}

/**
 * Component types that have corresponding CSS classes in @layer components
 * These classes are automatically added to the element when rendering
 */
const COMPONENT_TYPE_CLASSES = new Set(['card', 'badge', 'btn'])

/**
 * Build entrance animation class from interactions
 *
 * @param interactions - Component interactions
 * @returns Animation class or undefined
 */
function buildEntranceAnimationClass(interactions: Interactions | undefined): string | undefined {
  if (!interactions?.entrance?.animation) return undefined

  return `animate-${interactions.entrance.animation}`
}

/**
 * Configuration for building final className
 */
type BuildClassNameConfig = {
  readonly type: Component['type']
  readonly className: unknown
  readonly theme: Theme | undefined
  readonly substitutedProps: Record<string, unknown> | undefined
  readonly interactions: Interactions | undefined
}

/**
 * Build final className based on component type
 */
export function buildFinalClassName(config: BuildClassNameConfig): string | undefined {
  const { type, className, theme, substitutedProps, interactions } = config

  // Build classes array immutably
  const typeClass = COMPONENT_TYPE_CLASSES.has(type) ? type : undefined
  const flexClass = type === 'flex' ? buildFlexClasses(substitutedProps) : undefined
  const gridClass = type === 'grid' ? buildGridClasses(theme) : undefined
  const customClass = className as string | undefined
  const entranceClass = buildEntranceAnimationClass(interactions)
  // Don't add scroll animation class to initial className - it will be added by scroll-animation.js
  const scrollClass = undefined

  const classes = [typeClass, flexClass, gridClass, customClass, entranceClass, scrollClass]
    .filter(Boolean)
    .join(' ')
  return classes || undefined
}

/**
 * Apply shadow to style based on component type
 */
export function applyComponentShadow(
  type: Component['type'],
  style: Record<string, unknown> | undefined,
  theme: Theme | undefined
): Record<string, unknown> | undefined {
  const componentShadow = getComponentShadow(type, theme)
  return componentShadow ? { ...style, ...componentShadow } : style
}

/**
 * Process style with animations and shadows
 */
export function processComponentStyle(
  type: Component['type'],
  styleValue: unknown,
  theme: Theme | undefined,
  props?: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const baseStyle = parseComponentStyle(styleValue, props)
  const styleWithAnimations = applyComponentAnimations(type, baseStyle, theme)
  return applyComponentShadow(type, styleWithAnimations, theme)
}
