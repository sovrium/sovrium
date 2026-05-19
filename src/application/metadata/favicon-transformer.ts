/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FaviconSet, FaviconsConfig } from '@/domain/models/app/pages/meta'

function normalizeFaviconPath(href: string): string {
  return href.startsWith('./') ? href : `.${href}`
}

export function transformFaviconsConfigToSet(config: FaviconsConfig): FaviconSet {
  const iconItems = config.icon
    ? [
        {
          rel: 'icon' as const,
          type: 'image/svg+xml' as const,
          href: normalizeFaviconPath(config.icon),
        },
      ]
    : []

  const appleTouchIconItems = config.appleTouchIcon
    ? [
        {
          rel: 'apple-touch-icon' as const,
          href: normalizeFaviconPath(config.appleTouchIcon),
        },
      ]
    : []

  const sizeItems =
    config.sizes?.map((sizeItem) => ({
      rel: 'icon' as const,
      type: 'image/png' as const,
      sizes: sizeItem.size,
      href: normalizeFaviconPath(sizeItem.href),
    })) ?? []

  return [...iconItems, ...appleTouchIconItems, ...sizeItems]
}

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

export function normalizeFavicons(
  favicons: FaviconSet | FaviconsConfig | undefined
): FaviconSet | undefined {
  if (!favicons) return undefined
  if (isFaviconsConfig(favicons)) {
    return transformFaviconsConfigToSet(favicons)
  }
  return favicons as FaviconSet
}
