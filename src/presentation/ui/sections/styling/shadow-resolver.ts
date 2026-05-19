/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'
import type { Theme } from '@/domain/models/app/theme'

const STANDARD_SHADOWS = ['sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none'] as const

const COMPONENT_SHADOW_MAP: Record<string, readonly string[]> = {
  'list-item': ['sm'],
  dropdown: ['lg'],
  modal: ['xl'],
  input: ['inner'],
  button: ['brand', 'md'],
  card: [],
}

function findCustomShadow(shadows: Theme['shadows']): string | undefined {
  if (!shadows) return undefined
  return Object.keys(shadows).find((name) => !STANDARD_SHADOWS.includes(name as never))
}

function getShadowForType(type: Component['type'], shadows: Theme['shadows']): string | undefined {
  if (!shadows) return undefined

  if (type === 'card') {
    const customShadow = findCustomShadow(shadows)
    if (customShadow) {
      return `var(--shadow-${customShadow})`
    }
    return shadows.md ? 'var(--shadow-md)' : undefined
  }

  const shadowPriority = COMPONENT_SHADOW_MAP[type]
  if (!shadowPriority) {
    return undefined
  }

  const foundShadow = shadowPriority.find((shadowName) =>
    Boolean(shadows[shadowName as keyof typeof shadows])
  )

  return foundShadow ? `var(--shadow-${foundShadow})` : undefined
}

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
