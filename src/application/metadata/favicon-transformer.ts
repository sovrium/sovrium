/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FaviconSet } from '@/domain/models/app/page/meta/favicon-set'
import type { FaviconsConfig } from '@/domain/models/app/page/meta/favicons-config'

/**
 * Transforms FaviconsConfig (object format) to FaviconSet (array format)
 *
 * This function converts the simplified object-based configuration format
 * into the array-based FaviconSet format expected by the rendering components.
 *
 * Transformation rules:
 * - icon → { rel: 'icon', type: 'image/svg+xml', href: icon }
 * - appleTouchIcon → { rel: 'apple-touch-icon', href: appleTouchIcon }
 * - sizes → { rel: 'icon', type: 'image/png', sizes: size, href: href }
 *
 * @param config - FaviconsConfig object with named properties
 * @returns FaviconSet array with favicon items
 *
 * @example
 * ```typescript
 * const config = {
 *   icon: '/icon.svg',
 *   appleTouchIcon: '/apple-touch-icon.png',
 *   sizes: [
 *     { size: '32x32', href: '/favicon-32x32.png' },
 *     { size: '16x16', href: '/favicon-16x16.png' }
 *   ]
 * }
 *
 * const faviconSet = transformFaviconsConfigToSet(config)
 * // [
 * //   { rel: 'icon', type: 'image/svg+xml', href: './icon.svg' },
 * //   { rel: 'apple-touch-icon', href: './apple-touch-icon.png' },
 * //   { rel: 'icon', type: 'image/png', sizes: '32x32', href: './favicon-32x32.png' },
 * //   { rel: 'icon', type: 'image/png', sizes: '16x16', href: './favicon-16x16.png' }
 * // ]
 * ```
 */
export function transformFaviconsConfigToSet(config: FaviconsConfig): FaviconSet {
  const faviconSet: FaviconSet = []

  // Transform icon
  if (config.icon) {
    const href = config.icon.startsWith('./') ? config.icon : `.${config.icon}`
    faviconSet.push({
      rel: 'icon',
      type: 'image/svg+xml',
      href,
    })
  }

  // Transform appleTouchIcon
  if (config.appleTouchIcon) {
    const href = config.appleTouchIcon.startsWith('./')
      ? config.appleTouchIcon
      : `.${config.appleTouchIcon}`
    faviconSet.push({
      rel: 'apple-touch-icon',
      href,
    })
  }

  // Transform sizes
  if (config.sizes && config.sizes.length > 0) {
    for (const sizeItem of config.sizes) {
      const href = sizeItem.href.startsWith('./') ? sizeItem.href : `.${sizeItem.href}`
      faviconSet.push({
        rel: 'icon',
        type: 'image/png',
        sizes: sizeItem.size,
        href,
      })
    }
  }

  return faviconSet
}

/**
 * Type guard to check if favicons is FaviconsConfig (object format)
 */
export function isFaviconsConfig(
  favicons: FaviconSet | FaviconsConfig | undefined
): favicons is FaviconsConfig {
  if (!favicons) return false
  return (
    !Array.isArray(favicons) &&
    typeof favicons === 'object' &&
    ('icon' in favicons || 'appleTouchIcon' in favicons || 'sizes' in favicons)
  )
}

/**
 * Normalizes favicons to FaviconSet array format
 *
 * Accepts both FaviconSet (array) and FaviconsConfig (object) formats,
 * returning a normalized FaviconSet array.
 *
 * @param favicons - Favicons in either format
 * @returns FaviconSet array or undefined
 */
export function normalizeFavicons(
  favicons: FaviconSet | FaviconsConfig | undefined
): FaviconSet | undefined {
  if (!favicons) return undefined
  if (isFaviconsConfig(favicons)) {
    return transformFaviconsConfigToSet(favicons)
  }
  return favicons as FaviconSet
}
