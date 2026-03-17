/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { HexColorSchema } from '@/domain/models/app/common/definitions'

/**
 * Favicon relationship type
 *
 * 4 types of favicons for different contexts:
 * - icon: Standard browser favicon (most common)
 * - apple-touch-icon: iOS home screen icon
 * - manifest: PWA manifest file reference
 * - mask-icon: Safari pinned tab icon (monochrome SVG)
 */
export const FaviconRelSchema = Schema.Literal(
  'icon',
  'apple-touch-icon',
  'manifest',
  'mask-icon'
).annotations({
  description: 'Favicon relationship type',
})

/**
 * Favicon item in a multi-device favicon set
 *
 * Defines a single favicon for a specific device or context.
 *
 * Required properties:
 * - rel: Relationship type (icon, apple-touch-icon, manifest, mask-icon)
 * - href: Path to the favicon file (relative, starts with ./)
 *
 * Optional properties:
 * - type: MIME type (image/png, image/x-icon, image/svg+xml)
 * - sizes: Icon dimensions (16x16, 32x32, 180x180, 192x192, 512x512)
 * - color: Hex color for mask-icon (Safari pinned tab)
 *
 * Common favicon set:
 * - 16x16: Browser tab (small)
 * - 32x32: Browser tab (standard)
 * - 180x180: Apple touch icon (iOS home screen)
 * - 192x192: Android icon (home screen)
 * - 512x512: PWA icon (splash screen)
 *
 * @example
 * ```typescript
 * const browserIcon = {
 *   rel: 'icon',
 *   type: 'image/png',
 *   sizes: '32x32',
 *   href: './public/favicon/favicon-32x32.png'
 * }
 *
 * const appleIcon = {
 *   rel: 'apple-touch-icon',
 *   sizes: '180x180',
 *   href: './public/favicon/apple-touch-icon.png'
 * }
 *
 * const safariIcon = {
 *   rel: 'mask-icon',
 *   href: './public/favicon/safari-pinned-tab.svg',
 *   color: '#5BBAD5'
 * }
 *
 * const manifestRef = {
 *   rel: 'manifest',
 *   href: './public/favicon/site.webmanifest'
 * }
 * ```
 */
export const FaviconItemSchema = Schema.Struct({
  rel: FaviconRelSchema,
  type: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^image\//, {
        message: () => 'MIME type must start with image/ (e.g., image/png, image/x-icon)',
      })
    ).annotations({
      description: 'MIME type',
      examples: ['image/png', 'image/x-icon', 'image/svg+xml'],
    })
  ),
  sizes: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^[0-9]+x[0-9]+$/, {
        message: () => 'Sizes must be in format WIDTHxHEIGHT (e.g., 16x16, 32x32, 180x180)',
      })
    ).annotations({
      description: 'Icon dimensions',
      examples: ['16x16', '32x32', '180x180', '192x192'],
    })
  ),
  href: Schema.String.pipe(
    Schema.pattern(/^\.\//, {
      message: () => 'Favicon path must be relative starting with ./',
    })
  ).annotations({
    description: 'Path to the favicon file',
  }),
  color: Schema.optional(
    HexColorSchema.annotations({
      description: 'Color for mask-icon (Safari pinned tab)',
    })
  ),
}).annotations({
  description: 'Favicon item',
})

/**
 * Multiple favicon sizes and types for different devices
 *
 * Comprehensive favicon configuration for cross-device compatibility.
 * Includes icons for browsers, iOS, Android, PWAs, and Safari pinned tabs.
 *
 * Recommended favicon set:
 * 1. Browser tabs:
 *    - 16x16 (icon, image/png) - small display
 *    - 32x32 (icon, image/png) - standard display
 *
 * 2. iOS devices:
 *    - 180x180 (apple-touch-icon) - home screen icon
 *
 * 3. Android devices:
 *    - 192x192 (icon, image/png) - home screen icon
 *    - 512x512 (icon, image/png) - splash screen
 *
 * 4. Safari pinned tabs:
 *    - mask-icon (SVG) with color - monochrome pinned tab icon
 *
 * 5. PWA manifest:
 *    - manifest (site.webmanifest) - PWA configuration
 *
 * Browser support:
 * - icon: All browsers
 * - apple-touch-icon: Safari (iOS), Chrome (Android add to home screen)
 * - mask-icon: Safari 9+ (macOS pinned tabs)
 * - manifest: Chrome, Edge, Firefox, Safari (PWA support)
 *
 * @example
 * ```typescript
 * const completeFaviconSet = [
 *   // Browser tabs
 *   {
 *     rel: 'icon',
 *     type: 'image/png',
 *     sizes: '16x16',
 *     href: './public/favicon/favicon-16x16.png'
 *   },
 *   {
 *     rel: 'icon',
 *     type: 'image/png',
 *     sizes: '32x32',
 *     href: './public/favicon/favicon-32x32.png'
 *   },
 *   // iOS home screen
 *   {
 *     rel: 'apple-touch-icon',
 *     sizes: '180x180',
 *     href: './public/favicon/apple-touch-icon.png'
 *   },
 *   // Android/PWA
 *   {
 *     rel: 'icon',
 *     type: 'image/png',
 *     sizes: '192x192',
 *     href: './public/favicon/android-chrome-192x192.png'
 *   },
 *   {
 *     rel: 'icon',
 *     type: 'image/png',
 *     sizes: '512x512',
 *     href: './public/favicon/android-chrome-512x512.png'
 *   },
 *   // Safari pinned tabs
 *   {
 *     rel: 'mask-icon',
 *     href: './public/favicon/safari-pinned-tab.svg',
 *     color: '#5BBAD5'
 *   },
 *   // PWA manifest
 *   {
 *     rel: 'manifest',
 *     href: './public/favicon/site.webmanifest'
 *   }
 * ]
 * ```
 *
 * @see specs/app/pages/meta/favicons/favicon-set.schema.json
 */
export const FaviconSetSchema = Schema.Array(FaviconItemSchema).annotations({
  title: 'Favicon Set',
  description: 'Multiple favicon sizes and types for different devices',
})

export type FaviconRel = Schema.Schema.Type<typeof FaviconRelSchema>
export type FaviconItem = Schema.Schema.Type<typeof FaviconItemSchema>
export type FaviconSet = Schema.Schema.Type<typeof FaviconSetSchema>
