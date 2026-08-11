/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ============================================================================
// Preload
// ============================================================================

/**
 * Resource type hint for preloading
 *
 * 8 standard resource types for <link rel="preload" as="...">
 */
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

/**
 * CORS setting for preloaded resources
 */
export const PreloadCrossOriginSchema = Schema.Union(
  Schema.Boolean,
  Schema.Literal('anonymous', 'use-credentials')
).annotations({
  description: 'CORS setting for the resource',
})

/**
 * Preload resource configuration
 *
 * Defines a single resource to preload early in page load for performance optimization.
 */
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

/**
 * Resource preloading for performance optimization
 *
 * Array of critical resources to preload early in page load.
 */
export const PreloadSchema = Schema.Array(PreloadItemSchema).annotations({
  title: 'Resource Preloading',
  description: 'Preload critical resources for performance optimization',
})

/** @public */
export type PreloadResourceType = Schema.Schema.Type<typeof PreloadResourceTypeSchema>
/** @public */
export type PreloadCrossOrigin = Schema.Schema.Type<typeof PreloadCrossOriginSchema>
/** @public */
export type PreloadItem = Schema.Schema.Type<typeof PreloadItemSchema>
export type Preload = Schema.Schema.Type<typeof PreloadSchema>
