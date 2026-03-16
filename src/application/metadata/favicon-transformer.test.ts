/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import {
  isFaviconsConfig,
  normalizeFavicons,
  transformFaviconsConfigToSet,
} from './favicon-transformer'
import type { FaviconSet } from '@/domain/models/app/page/meta/favicon-set'
import type { FaviconsConfig } from '@/domain/models/app/page/meta/favicons-config'

describe('transformFaviconsConfigToSet', () => {
  test('should transform icon property', () => {
    const config: FaviconsConfig = {
      icon: '/icon.svg',
    }

    const result = transformFaviconsConfigToSet(config)

    expect(result).toEqual([
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: './icon.svg',
      },
    ])
  })

  test('should transform appleTouchIcon property', () => {
    const config: FaviconsConfig = {
      appleTouchIcon: '/apple-touch-icon.png',
    }

    const result = transformFaviconsConfigToSet(config)

    expect(result).toEqual([
      {
        rel: 'apple-touch-icon',
        href: './apple-touch-icon.png',
      },
    ])
  })

  test('should transform sizes property', () => {
    const config: FaviconsConfig = {
      sizes: [
        { size: '32x32', href: '/favicon-32x32.png' },
        { size: '16x16', href: '/favicon-16x16.png' },
      ],
    }

    const result = transformFaviconsConfigToSet(config)

    expect(result).toEqual([
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: './favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: './favicon-16x16.png',
      },
    ])
  })

  test('should transform complete config with all properties', () => {
    const config: FaviconsConfig = {
      icon: '/icon.svg',
      appleTouchIcon: '/apple-touch-icon.png',
      sizes: [{ size: '32x32', href: '/favicon-32x32.png' }],
    }

    const result = transformFaviconsConfigToSet(config)

    expect(result).toEqual([
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: './icon.svg',
      },
      {
        rel: 'apple-touch-icon',
        href: './apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: './favicon-32x32.png',
      },
    ])
  })

  test('should preserve ./ prefix if already present', () => {
    const config: FaviconsConfig = {
      icon: './icon.svg',
      appleTouchIcon: './apple-touch-icon.png',
      sizes: [{ size: '32x32', href: './favicon-32x32.png' }],
    }

    const result = transformFaviconsConfigToSet(config)

    expect(result).toEqual([
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: './icon.svg',
      },
      {
        rel: 'apple-touch-icon',
        href: './apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: './favicon-32x32.png',
      },
    ])
  })

  test('should handle empty config', () => {
    const config: FaviconsConfig = {}

    const result = transformFaviconsConfigToSet(config)

    expect(result).toEqual([])
  })

  test('should handle empty sizes array', () => {
    const config: FaviconsConfig = {
      icon: '/icon.svg',
      sizes: [],
    }

    const result = transformFaviconsConfigToSet(config)

    expect(result).toEqual([
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: './icon.svg',
      },
    ])
  })
})

describe('isFaviconsConfig', () => {
  test('should return true for object with icon property', () => {
    const config: FaviconsConfig = { icon: '/icon.svg' }
    expect(isFaviconsConfig(config)).toBe(true)
  })

  test('should return true for object with appleTouchIcon property', () => {
    const config: FaviconsConfig = { appleTouchIcon: '/apple-touch-icon.png' }
    expect(isFaviconsConfig(config)).toBe(true)
  })

  test('should return true for object with sizes property', () => {
    const config: FaviconsConfig = { sizes: [] }
    expect(isFaviconsConfig(config)).toBe(true)
  })

  test('should return false for array (FaviconSet)', () => {
    const faviconSet: FaviconSet = [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: './favicon-32x32.png',
      },
    ]
    expect(isFaviconsConfig(faviconSet)).toBe(false)
  })

  test('should return false for undefined', () => {
    expect(isFaviconsConfig(undefined)).toBe(false)
  })

  test('should return false for empty object', () => {
    expect(isFaviconsConfig({})).toBe(false)
  })
})

describe('normalizeFavicons', () => {
  test('should return undefined for undefined input', () => {
    expect(normalizeFavicons(undefined)).toBeUndefined()
  })

  test('should transform FaviconsConfig to FaviconSet', () => {
    const config: FaviconsConfig = {
      icon: '/icon.svg',
    }

    const result = normalizeFavicons(config)

    expect(result).toEqual([
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: './icon.svg',
      },
    ])
  })

  test('should return FaviconSet unchanged', () => {
    const faviconSet: FaviconSet = [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: './favicon-32x32.png',
      },
    ]

    const result = normalizeFavicons(faviconSet)

    expect(result).toBe(faviconSet)
  })
})
