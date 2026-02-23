/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Component types and their corresponding theme color mapping
 */
const COMPONENT_COLOR_MAP: Record<string, keyof NonNullable<Theme['colors']>> = {
  header: 'primary',
  footer: 'secondary',
  hero: 'background',
}

/**
 * Apply theme colors to section elements automatically
 *
 * Maps component types to theme colors:
 * - header → theme.colors.primary
 * - footer → theme.colors.secondary
 * - hero → theme.colors.background
 *
 * @param type - Component type
 * @param theme - Theme configuration
 * @returns Style object with background color or undefined
 */
export function getSectionColorStyle(
  type: Component['type'],
  theme?: Theme
): Record<string, unknown> | undefined {
  if (!theme?.colors) return undefined

  const colorKey = COMPONENT_COLOR_MAP[type]
  if (!colorKey) return undefined

  const color = theme.colors[colorKey]
  return color ? { backgroundColor: color } : undefined
}
