/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Size specification for favicon
 */
export const FaviconSizeItemSchema = Schema.Struct({
  size: Schema.String.pipe(
    Schema.pattern(/^[0-9]+x[0-9]+$/, {
      message: () => 'Size must be in format WIDTHxHEIGHT (e.g., 16x16, 32x32)',
    })
  ).annotations({
    description: 'Icon dimensions (e.g., 32x32, 16x16)',
  }),
  href: Schema.String.annotations({
    description: 'Path to the favicon file',
  }),
}).annotations({
  description: 'Favicon size specification',
})

/**
 * Helper configuration for favicons with named properties
 *
 * This is a convenience format that gets transformed into FaviconSet array.
 * Provides a simpler API for common favicon configurations.
 *
 * Properties:
 * - icon: Default favicon (usually SVG or ICO)
 * - appleTouchIcon: iOS home screen icon
 * - sizes: Array of size-specific PNG favicons
 *
 * @example
 * ```typescript
 * const faviconsConfig = {
 *   icon: '/icon.svg',
 *   appleTouchIcon: '/apple-touch-icon.png',
 *   sizes: [
 *     { size: '32x32', href: '/favicon-32x32.png' },
 *     { size: '16x16', href: '/favicon-16x16.png' }
 *   ]
 * }
 * ```
 */
export const FaviconsConfigSchema = Schema.Struct({
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Default icon (SVG or ICO)',
    })
  ),
  appleTouchIcon: Schema.optional(
    Schema.String.annotations({
      description: 'iOS home screen icon',
    })
  ),
  sizes: Schema.optional(
    Schema.Array(FaviconSizeItemSchema).annotations({
      description: 'Size-specific favicons',
    })
  ),
}).annotations({
  title: 'Favicons Configuration',
  description: 'Helper configuration for favicons with named properties',
})

export type FaviconSizeItem = Schema.Schema.Type<typeof FaviconSizeItemSchema>
export type FaviconsConfig = Schema.Schema.Type<typeof FaviconsConfigSchema>
