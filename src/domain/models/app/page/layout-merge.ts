/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Layout } from './layout'

/**
 * Merges default layout with page-specific layout
 *
 * Rules:
 * - undefined: Use defaultLayout (inherit all)
 * - null: No layout (explicit override - no components)
 * - object: Smart merge based on overlap with default
 *
 * Smart merge logic:
 * - If page specifies component(s) that overlap with default → REPLACE mode (use ONLY page components)
 * - If page specifies component(s) that don't overlap with default → EXTEND mode (merge with default)
 *
 * @param defaultLayout - Default layout from app configuration
 * @param pageLayout - Page-specific layout (can be undefined, null, or object)
 * @returns Merged layout configuration
 *
 * @example
 * ```typescript
 * // Page with no layout override - uses default
 * mergeLayouts(
 *   { navigation: {...}, footer: {...} },
 *   undefined
 * )
 * // => { navigation: {...}, footer: {...} }
 *
 * // Page with explicit null - no layout
 * mergeLayouts(
 *   { navigation: {...}, footer: {...} },
 *   null
 * )
 * // => undefined
 *
 * // Page adds sidebar (no overlap) - extends default
 * mergeLayouts(
 *   { navigation: {...}, footer: {...} },
 *   { sidebar: {...} }
 * )
 * // => { navigation: {...}, footer: {...}, sidebar: {...} }
 *
 * // Page overrides navigation (overlap) - replaces default
 * mergeLayouts(
 *   { navigation: { logo: '/default.svg' }, footer: {...} },
 *   { navigation: { logo: '/custom.svg' } }
 * )
 * // => { navigation: { logo: '/custom.svg' } }
 * ```
 */
export function mergeLayouts(
  defaultLayout: Layout | undefined,
  pageLayout: Layout | null | undefined
): Layout | undefined {
  // Page explicitly disables layout with null
  if (pageLayout === null) {
    return undefined
  }

  // Page has no layout specified - use default
  if (pageLayout === undefined) {
    return defaultLayout
  }

  // No default layout - use page layout as-is
  if (!defaultLayout) {
    return pageLayout
  }

  // Check if page layout overlaps with default layout
  const components: ReadonlyArray<keyof Layout> = ['banner', 'navigation', 'footer', 'sidebar']
  const defaultComponents = new Set(components.filter((c) => defaultLayout[c] !== undefined))
  const pageComponents = components.filter((c) => pageLayout[c] !== undefined)

  // Check if any page component exists in default (overlap)
  const hasOverlap = pageComponents.some((c) => defaultComponents.has(c))

  if (hasOverlap) {
    // REPLACE mode: Page overrides default - use ONLY page components
    return pageLayout
  }

  // EXTEND mode: Page adds to default - merge both
  return {
    ...defaultLayout,
    ...pageLayout,
  }
}
