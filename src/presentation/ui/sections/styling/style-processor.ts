/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
import type { Component } from '@/domain/models/app/pages/components'
import type { Interactions } from '@/domain/models/app/pages/components/interactions/interactions'
import type { Theme } from '@/domain/models/app/theme'

export function extractCssProperties(props: Record<string, unknown> | undefined): {
  readonly cssProps: Record<string, unknown>
  readonly remainingProps: Record<string, unknown>
} {
  if (!props) {
    return { cssProps: {}, remainingProps: {} }
  }

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

export function parseComponentStyle(
  styleValue: unknown,
  props: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const explicitStyle = styleValue
    ? normalizeStyleAnimations(
        typeof styleValue === 'string'
          ? parseStyle(styleValue)
          : (styleValue as Record<string, unknown>)
      )
    : undefined

  const { cssProps } = extractCssProperties(props)

  const { style: _style, ...cssPropsWithoutStyle } = cssProps

  const mergedStyle = {
    ...cssPropsWithoutStyle,
    ...explicitStyle,
  }

  return Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined
}

const COMPONENT_TYPE_CLASS_MAP: Partial<Record<string, string>> = {
  card: 'card',
  badge: 'badge',
  btn: 'btn',
  button: 'btn',
}

function buildEntranceAnimationClass(interactions: Interactions | undefined): string | undefined {
  if (!interactions?.entrance?.animation) return undefined

  return `animate-${interactions.entrance.animation}`
}

type BuildClassNameConfig = {
  readonly type: Component['type']
  readonly className: unknown
  readonly substitutedProps: Record<string, unknown> | undefined
  readonly interactions: Interactions | undefined
  readonly variant?: string
  readonly size?: string
  readonly badgeVariant?: string
}

function buildButtonModifierClasses(
  type: Component['type'],
  variant: string | undefined,
  size: string | undefined
): { variantClass: string | undefined; sizeClass: string | undefined } {
  const isButton = type === 'button' || type === 'btn'
  return {
    variantClass: isButton && variant && variant !== 'default' ? `btn-${variant}` : undefined,
    sizeClass: isButton && size && size !== 'md' ? `btn-${size}` : undefined,
  }
}

function buildBadgeModifierClass(
  type: Component['type'],
  badgeVariant: string | undefined
): string | undefined {
  const isBadge = type === 'badge'
  return isBadge && badgeVariant && badgeVariant !== 'default' ? `badge-${badgeVariant}` : undefined
}

export function buildFinalClassName(config: BuildClassNameConfig): string | undefined {
  const { type, className, substitutedProps, interactions, variant, size, badgeVariant } = config

  const typeClass = COMPONENT_TYPE_CLASS_MAP[type]
  const { variantClass, sizeClass } = buildButtonModifierClasses(type, variant, size)
  const badgeVariantClass = buildBadgeModifierClass(type, badgeVariant)
  const flexClass = type === 'flex' ? buildFlexClasses(substitutedProps) : undefined
  const gridClass = type === 'grid' ? buildGridClasses(substitutedProps) : undefined
  const customClass = className as string | undefined
  const entranceClass = buildEntranceAnimationClass(interactions)
  const scrollClass = undefined

  const classes = [
    typeClass,
    variantClass,
    sizeClass,
    badgeVariantClass,
    flexClass,
    gridClass,
    customClass,
    entranceClass,
    scrollClass,
  ]
    .filter(Boolean)
    .join(' ')
  return classes || undefined
}

export function applyComponentShadow(
  type: Component['type'],
  style: Record<string, unknown> | undefined,
  theme: Theme | undefined
): Record<string, unknown> | undefined {
  const componentShadow = getComponentShadow(type, theme)
  return componentShadow ? { ...style, ...componentShadow } : style
}

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
