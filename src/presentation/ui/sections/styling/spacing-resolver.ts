/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isCssValue } from '@/presentation/styling/style-utils'
import { getSectionColorStyle } from './color-resolver'
import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Component types that should receive section spacing
 */
const SECTION_TYPES = new Set(['section', 'header', 'footer', 'hero'])

/**
 * Apply theme spacing to section elements when spacing.section is a CSS value
 */
export function getSectionSpacingStyle(
  type: Component['type'],
  theme?: Theme
): Record<string, unknown> | undefined {
  const sectionSpacing = SECTION_TYPES.has(type) && theme?.spacing?.section
  return sectionSpacing && isCssValue(sectionSpacing) ? { padding: sectionSpacing } : undefined
}

/**
 * Apply theme spacing to container elements when spacing.container is a CSS value
 */
export function getContainerSpacingStyle(
  type: Component['type'],
  theme?: Theme
): Record<string, unknown> | undefined {
  const containerSpacing = type === 'container' && theme?.spacing?.container
  return containerSpacing && isCssValue(containerSpacing)
    ? { maxWidth: containerSpacing, margin: '0 auto' }
    : undefined
}

/**
 * Apply theme spacing to flex elements when spacing.gap is a CSS value
 */
export function getFlexSpacingStyle(
  type: Component['type'],
  theme?: Theme
): Record<string, unknown> | undefined {
  const flexSpacing = type === 'flex' && theme?.spacing?.gap
  return flexSpacing && isCssValue(flexSpacing) ? { display: 'flex', gap: flexSpacing } : undefined
}

/**
 * Apply all spacing and color styles in order: color → section → container → flex
 */
export function applySpacingStyles(
  type: Component['type'],
  baseProps: Record<string, unknown>,
  theme?: Theme
): Record<string, unknown> {
  const colorStyle = getSectionColorStyle(type, theme)
  const propsWithColor = colorStyle
    ? {
        ...baseProps,
        style: {
          ...(baseProps.style as Record<string, unknown> | undefined),
          ...colorStyle,
        },
      }
    : baseProps

  const sectionSpacingStyle = getSectionSpacingStyle(type, theme)
  const propsWithSection = sectionSpacingStyle
    ? {
        ...propsWithColor,
        style: {
          ...(propsWithColor.style as Record<string, unknown> | undefined),
          ...sectionSpacingStyle,
        },
      }
    : propsWithColor

  const containerSpacingStyle = getContainerSpacingStyle(type, theme)
  const propsWithContainer = containerSpacingStyle
    ? {
        ...propsWithSection,
        style: {
          ...(propsWithSection.style as Record<string, unknown> | undefined),
          ...containerSpacingStyle,
        },
      }
    : propsWithSection

  const flexSpacingStyle = getFlexSpacingStyle(type, theme)
  return flexSpacingStyle
    ? {
        ...propsWithContainer,
        style: {
          ...(propsWithContainer.style as Record<string, unknown> | undefined),
          ...flexSpacingStyle,
        },
      }
    : propsWithContainer
}
