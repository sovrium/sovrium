/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Default favicon path
 *
 * Simple string pointing to the default favicon file.
 * Supports 3 formats: .ico (legacy), .png (modern), .svg (scalable).
 *
 * Pattern: Must be a relative path starting with ./ and ending with .ico, .png, or .svg
 *
 * Common locations:
 * - ./public/favicon.ico (Next.js, React, standard)
 * - ./favicon.png (root directory)
 * - ./assets/favicon.svg (assets folder)
 *
 * Format recommendations:
 * - .ico: Legacy support (IE11, old browsers), 16x16 or 32x32
 * - .png: Modern standard, 32x32 or 192x192
 * - .svg: Scalable, best quality, smallest file size
 *
 * Use this for simple favicon setup. For multi-device support with
 * Apple touch icons, Android icons, etc., use FaviconSetSchema instead.
 *
 * @example
 * ```typescript
 * const icoFavicon = './public/favicon.ico'
 * const pngFavicon = './favicon.png'
 * const svgFavicon = './assets/favicon.svg'
 * ```
 *
 * @see specs/app/pages/meta/favicons/favicon.schema.json
 */
export const FaviconSchema = Schema.String.pipe(
  Schema.pattern(/^\.\/.+\.(ico|png|svg)$/, {
    message: () =>
      'Favicon must be a relative path starting with ./ and ending with .ico, .png, or .svg (e.g., ./public/favicon.ico)',
  })
).annotations({
  title: 'Favicon',
  description: 'Default favicon path',
})

export type Favicon = Schema.Schema.Type<typeof FaviconSchema>
