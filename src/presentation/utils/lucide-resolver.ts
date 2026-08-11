/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as LucideIcons from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * Shared Lucide icon resolution, used by both the SSR renderers
 * (`icon-renderer`, `DocsSidebarNav`) and the client islands (`menu-island`,
 * `kpi-card`) so every surface resolves the same kebab-case icon vocabulary.
 */

/**
 * Converts a kebab-case icon name to PascalCase for Lucide lookup.
 * Example: 'check-circle' -> 'CheckCircle', 'arrow-right' -> 'ArrowRight'.
 */
export const kebabToPascalCase = (name: string): string =>
  name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

/**
 * Resolves a Lucide icon component by kebab-case name. Returns undefined when
 * no matching component exists (callers fall back to label-only / a placeholder).
 *
 * Lucide icons use forwardRef, so they are objects (typeof === 'object') in the
 * Bun runtime, not plain functions — both are valid React components.
 */
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
