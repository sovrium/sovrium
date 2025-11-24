/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { CONTAINER_TYPES } from '../component-renderer.types'
import { buildFlexClasses, buildGridClasses } from '../styling/component-styling'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Build data-testid based on blockName and instanceIndex
 */
export function buildTestId(
  blockName?: string,
  blockInstanceIndex?: number,
  type?: string,
  substitutedProps?: Record<string, unknown>
): string | undefined {
  if (blockName) {
    return blockInstanceIndex !== undefined
      ? `block-${blockName}-${blockInstanceIndex}`
      : `block-${blockName}`
  }

  const dataTestId = substitutedProps?.['data-testid']
  if (typeof dataTestId === 'string') {
    return dataTestId
  }

  // Auto-generate testid for common component types to support testing
  if (type === 'container') return 'container'
  if (type === 'flex') return 'flex'
  if (type === 'text') return 'text'

  return undefined
}

/**
 * Component types that have corresponding CSS classes
 * These types will automatically get their type name added as a CSS class
 */
const COMPONENT_TYPES_WITH_CSS_CLASSES = new Set(['card', 'badge'])

/**
 * Build final className based on component type and theme
 */
export function buildClassName(
  type: string,
  substitutedProps?: Record<string, unknown>,
  theme?: Theme
): string | undefined {
  if (type === 'flex') {
    return [buildFlexClasses(substitutedProps), substitutedProps?.className]
      .filter(Boolean)
      .join(' ')
  }

  if (type === 'grid') {
    return [buildGridClasses(theme), substitutedProps?.className].filter(Boolean).join(' ')
  }

  // Auto-apply component type as CSS class for types with CSS definitions
  if (COMPONENT_TYPES_WITH_CSS_CLASSES.has(type)) {
    return [type, substitutedProps?.className].filter(Boolean).join(' ')
  }

  return substitutedProps?.className as string | undefined
}

/**
 * Build block data attributes
 */
function buildBlockDataAttrs(blockName?: string, type?: string) {
  if (!blockName) {
    return {}
  }
  return {
    'data-block': blockName,
    'data-type': type,
  }
}

/**
 * Build translation data attributes
 */
function buildTranslationDataAttrs(
  firstTranslationKey?: string,
  translationData?: Record<string, unknown>
) {
  if (!firstTranslationKey || !translationData) {
    return {}
  }
  return {
    'data-translation-key': firstTranslationKey,
    'data-translations': JSON.stringify(translationData),
  }
}

/**
 * Build empty content style
 */
function buildEmptyStyle(
  blockName?: string,
  type?: string,
  hasContent?: boolean,
  styleWithShadow?: Record<string, unknown>
) {
  if (blockName && !hasContent) {
    return {
      ...styleWithShadow,
      minHeight: '1px',
      minWidth: '1px',
      display: 'inline-block',
    }
  }
  if (!blockName && type === 'grid' && !hasContent) {
    return {
      ...styleWithShadow,
      minHeight: '100px',
      minWidth: '100px',
    }
  }
  return styleWithShadow
}

/**
 * Build element props including data attributes, ARIA, and styling
 */
export function buildElementProps({
  component,
  substitutedProps,
  finalClassName,
  styleWithShadow,
  testId,
  blockName,
  firstTranslationKey,
  translationData,
  hasScrollAnimation,
  hasContent,
  children,
}: {
  readonly component: Component
  readonly substitutedProps?: Record<string, unknown>
  readonly finalClassName?: string
  readonly styleWithShadow?: Record<string, unknown>
  readonly testId?: string
  readonly blockName?: string
  readonly firstTranslationKey?: string
  readonly translationData?: Record<string, unknown>
  readonly hasScrollAnimation?: boolean
  readonly hasContent?: boolean
  readonly children?: readonly (Component | string)[]
}): Record<string, unknown> {
  const { type } = component
  const hasChildren = Boolean(children?.length)
  const finalStyle = buildEmptyStyle(blockName, type, hasContent, styleWithShadow)

  return {
    ...substitutedProps,
    className: finalClassName,
    ...(finalStyle && { style: finalStyle }),
    ...(testId && { 'data-testid': testId }),
    ...buildBlockDataAttrs(blockName, type),
    ...(blockName && hasChildren && CONTAINER_TYPES.includes(type) && { role: 'group' }),
    ...buildTranslationDataAttrs(firstTranslationKey, translationData),
    ...(hasScrollAnimation && { 'data-scroll-animation': 'scale-up' }),
  }
}

/**
 * Convert custom props to data-* attributes for badge components
 * Standard HTML attributes (className, style, id, etc.) pass through unchanged
 *
 * Re-exported from prop-conversion module for backward compatibility
 */
export { convertBadgeProps } from './prop-conversion'
