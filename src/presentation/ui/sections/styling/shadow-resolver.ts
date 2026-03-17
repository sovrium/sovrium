/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/page/sections'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Standard shadow size names
 */
const STANDARD_SHADOWS = ['sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none'] as const

/**
 * Shadow mapping for component types
 */
const COMPONENT_SHADOW_MAP: Record<string, readonly string[]> = {
  'list-item': ['sm'],
  dropdown: ['lg'],
  modal: ['xl'],
  input: ['inner'],
  button: ['brand', 'md'],
  card: [], // Card uses custom logic
}

/**
 * Find first available custom shadow (non-standard)
 */
function findCustomShadow(shadows: Theme['shadows']): string | undefined {
  if (!shadows) return undefined
  return Object.keys(shadows).find((name) => !STANDARD_SHADOWS.includes(name as never))
}

/**
 * Get shadow value for component type
 */
function getShadowForType(type: Component['type'], shadows: Theme['shadows']): string | undefined {
  if (!shadows) return undefined

  // Special handling for card: custom shadows first, then md
  if (type === 'card') {
    const customShadow = findCustomShadow(shadows)
    if (customShadow) {
      return `var(--shadow-${customShadow})`
    }
    return shadows.md ? 'var(--shadow-md)' : undefined
  }

  // Standard component shadow resolution
  const shadowPriority = COMPONENT_SHADOW_MAP[type]
  if (!shadowPriority) {
    return undefined
  }

  const foundShadow = shadowPriority.find((shadowName) =>
    Boolean(shadows[shadowName as keyof typeof shadows])
  )

  return foundShadow ? `var(--shadow-${foundShadow})` : undefined
}

/**
 * Apply theme shadows to component types based on conventions
 * - Card components use available shadow tokens (md, neumorphic, etc.)
 * - Modal components use xl shadow
 * - Input components use inner shadow
 * - Button components use md shadow (or custom like brand)
 * - List-item components use sm shadow (lowest elevation)
 * - Dropdown components use lg shadow (higher than card, lower than modal)
 */
export function getComponentShadow(
  type: Component['type'],
  theme?: Theme
): Record<string, unknown> | undefined {
  if (!theme?.shadows) {
    return undefined
  }

  const shadowValue = getShadowForType(type, theme.shadows)
  return shadowValue ? { boxShadow: shadowValue } : undefined
}
