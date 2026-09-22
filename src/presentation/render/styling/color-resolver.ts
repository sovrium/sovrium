/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Design } from '@/domain/models/app/design'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Component types and their corresponding design color mapping
 */
const COMPONENT_COLOR_MAP: Record<string, keyof NonNullable<Design['colors']>> = {
  header: 'primary',
  footer: 'secondary',
}

/**
 * Apply design colors to section elements automatically
 *
 * Maps component types to design colors:
 * - header → design.colors.primary
 * - footer → design.colors.secondary
 *
 * @param type - Component type
 * @param design - Design configuration
 * @returns Style object with background color or undefined
 */
export function getSectionColorStyle(
  type: Component['type'],
  design?: Design
): Record<string, unknown> | undefined {
  if (!design?.colors) return undefined

  const colorKey = COMPONENT_COLOR_MAP[type]
  if (!colorKey) return undefined

  const color = design.colors[colorKey]
  return color ? { backgroundColor: color } : undefined
}
