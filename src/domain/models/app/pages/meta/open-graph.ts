/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { HttpUrlOrRecordTemplateSchema } from '@/domain/types/url'


export const OpenGraphTypeSchema = Schema.Literal(
  'website',
  'article',
  'book',
  'profile',
  'video',
  'music'
).annotations({
  description: 'Open Graph object type',
})

export const OpenGraphLocaleSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z]{2}_[A-Z]{2}$/, {
    message: () =>
      'Locale must be in format language_TERRITORY (e.g., en_US, fr_FR, es_ES, de_DE, ja_JP)',
  })
).annotations({
  description: 'Locale in format language_TERRITORY',
  examples: ['en_US', 'fr_FR', 'es_ES'],
})

export const OpenGraphDeterminerSchema = Schema.Literal('a', 'an', 'the', 'auto', '').annotations({
  description: 'Word that appears before the title',
})

export const OpenGraphSchema = Schema.Struct({
  title: Schema.optional(
    Schema.String.pipe(Schema.maxLength(90)).annotations({
      description: 'Open Graph title (may differ from page title)',
    })
  ),
  description: Schema.optional(
    Schema.String.pipe(Schema.maxLength(200)).annotations({
      description: 'Open Graph description',
    })
  ),
  type: Schema.optional(OpenGraphTypeSchema),
  url: Schema.optional(
    HttpUrlOrRecordTemplateSchema.annotations({
      description: 'Canonical URL for this page',
    })
  ),
  image: Schema.optional(
    HttpUrlOrRecordTemplateSchema.annotations({
      description: 'Image URL for social sharing (recommended: 1200x630px)',
    })
  ),
  imageAlt: Schema.optional(
    Schema.String.annotations({
      description: 'Alternative text for the Open Graph image',
    })
  ),
  siteName: Schema.optional(
    Schema.String.annotations({
      description: 'Name of the overall website',
    })
  ),
  locale: Schema.optional(OpenGraphLocaleSchema),
  determiner: Schema.optional(OpenGraphDeterminerSchema),
  video: Schema.optional(
    HttpUrlOrRecordTemplateSchema.annotations({
      description: 'Video URL if sharing video content',
    })
  ),
  audio: Schema.optional(
    HttpUrlOrRecordTemplateSchema.annotations({
      description: 'Audio URL if sharing audio content',
    })
  ),
}).annotations({
  title: 'Open Graph Metadata',
  description: 'Open Graph protocol metadata for rich social media sharing',
})

export type OpenGraphType = Schema.Schema.Type<typeof OpenGraphTypeSchema>
export type OpenGraphLocale = Schema.Schema.Type<typeof OpenGraphLocaleSchema>
export type OpenGraphDeterminer = Schema.Schema.Type<typeof OpenGraphDeterminerSchema>
export type OpenGraph = Schema.Schema.Type<typeof OpenGraphSchema>
