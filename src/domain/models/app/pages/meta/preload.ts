/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const PreloadResourceTypeSchema = Schema.Literal(
  'style',
  'script',
  'font',
  'image',
  'video',
  'audio',
  'document',
  'fetch'
).annotations({
  description: 'Resource type hint',
})

export const PreloadCrossOriginSchema = Schema.Union(
  Schema.Boolean,
  Schema.Literal('anonymous', 'use-credentials')
).annotations({
  description: 'CORS setting for the resource',
})

export const PreloadItemSchema = Schema.Struct({
  href: Schema.String.annotations({
    description: 'Resource URL to preload',
  }),
  as: PreloadResourceTypeSchema,
  type: Schema.optional(
    Schema.String.annotations({
      description: 'MIME type for the resource',
    })
  ),
  crossorigin: Schema.optional(PreloadCrossOriginSchema),
  media: Schema.optional(
    Schema.String.annotations({
      description: 'Media query for conditional loading',
    })
  ),
}).annotations({
  description: 'Preload resource',
})

export const PreloadSchema = Schema.Array(PreloadItemSchema).annotations({
  title: 'Resource Preloading',
  description: 'Preload critical resources for performance optimization',
})

export type PreloadResourceType = Schema.Schema.Type<typeof PreloadResourceTypeSchema>
export type PreloadCrossOrigin = Schema.Schema.Type<typeof PreloadCrossOriginSchema>
export type PreloadItem = Schema.Schema.Type<typeof PreloadItemSchema>
export type Preload = Schema.Schema.Type<typeof PreloadSchema>
