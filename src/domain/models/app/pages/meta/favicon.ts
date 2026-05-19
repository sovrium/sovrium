/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { HexColorSchema } from '@/domain/types/definitions'


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


export const FaviconRelSchema = Schema.Literal(
  'icon',
  'apple-touch-icon',
  'manifest',
  'mask-icon'
).annotations({
  description: 'Favicon relationship type',
})

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

export const FaviconSetSchema = Schema.Array(FaviconItemSchema).annotations({
  title: 'Favicon Set',
  description: 'Multiple favicon sizes and types for different devices',
})

export type FaviconRel = Schema.Schema.Type<typeof FaviconRelSchema>
export type FaviconItem = Schema.Schema.Type<typeof FaviconItemSchema>
export type FaviconSet = Schema.Schema.Type<typeof FaviconSetSchema>


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
