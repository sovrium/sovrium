/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'
import type { Theme } from '@/domain/models/app/theme'

const COMPONENT_COLOR_MAP: Record<string, keyof NonNullable<Theme['colors']>> = {
  header: 'primary',
  footer: 'secondary',
  hero: 'background',
}

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
