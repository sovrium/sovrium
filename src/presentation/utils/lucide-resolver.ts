/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as LucideIcons from 'lucide-react'
import type { ComponentType } from 'react'


export const kebabToPascalCase = (name: string): string =>
  name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

export const resolveLucideIcon = (
  iconName: string | undefined
): ComponentType<Record<string, unknown>> | undefined => {
  if (!iconName) return undefined
  const component = (LucideIcons as Record<string, unknown>)[kebabToPascalCase(iconName)]
  if (typeof component === 'function') return component as ComponentType<Record<string, unknown>>
  if (typeof component === 'object' && component !== null)
    return component as ComponentType<Record<string, unknown>>
  return undefined
}
