/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { HttpUrlSchema } from '../common/url'

/**
 * Open Graph content type
 *
 * 6 standard Open Graph types for different content:
 * - website: General websites, landing pages (most common, default)
 * - article: Blog posts, news articles (adds publish date, author metadata)
 * - book: Book pages, publications
 * - profile: Personal or company profiles
 * - video: Video content pages (enables video embeds in social feeds)
 * - music: Music content, albums (enables audio players)
 */
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

/**
 * Open Graph locale format
 *
 * Language and territory format: [language]_[TERRITORY]
 * - Pattern: ^[a-z]{2}_[A-Z]{2}$ (2 lowercase + underscore + 2 uppercase)
 * - Examples: en_US (English, United States), fr_FR (French, France), es_ES (Spanish, Spain)
 * - Helps platforms show content to the right audience based on language/region
 */
export const OpenGraphLocaleSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z]{2}_[A-Z]{2}$/, {
    message: () =>
      'Locale must be in format language_TERRITORY (e.g., en_US, fr_FR, es_ES, de_DE, ja_JP)',
  })
).annotations({
  description: 'Locale in format language_TERRITORY',
  examples: ['en_US', 'fr_FR', 'es_ES'],
})

/**
 * Open Graph determiner
 *
 * Grammatical article that appears before the title in share messages.
 * Used in: "John shared [determiner] [title]"
 *
 * 5 options:
 * - 'a': "Share a Website Builder"
 * - 'an': "Share an Amazing Product"
 * - 'the': "Share the Ultimate Guide to SEO"
 * - 'auto': Platform decides based on title (no article)
 * - '': Empty string (no article)
 *
 * Improves grammar in social sharing messages for better user experience.
 */
export const OpenGraphDeterminerSchema = Schema.Literal('a', 'an', 'the', 'auto', '').annotations({
  description: 'Word that appears before the title',
})

/**
 * Open Graph protocol metadata for rich social media sharing
 *
 * Defines how pages appear when shared on Facebook, LinkedIn, and other platforms
 * supporting the Open Graph protocol. Creates rich preview cards with images, titles,
 * and descriptions to dramatically increase engagement and click-through rates.
 *
 * Required properties:
 * - title: Page title for social sharing (max 90 chars, shorter than page <title>)
 * - description: Page description (max 200 chars, concise value proposition)
 * - type: Content type (website, article, book, profile, video, music)
 * - url: Canonical URL for this page (absolute URL)
 *
 * Optional properties:
 * - image: Social sharing image URL (recommended: 1200x630px, 1.91:1 aspect ratio)
 * - imageAlt: Alternative text for the image (accessibility, screen readers)
 * - siteName: Overall website/brand name (different from page title)
 * - locale: Content language/territory (en_US, fr_FR, etc.)
 * - determiner: Grammatical article before title (a, an, the, auto, "")
 * - video: Video URL for video content (enables video embeds in feeds)
 * - audio: Audio URL for audio content (enables audio players)
 *
 * Impact:
 * - Rich cards get 2-3x more clicks than plain links
 * - Image is most important element (grabs attention)
 * - Without OG tags: generic unfurl with no image (low engagement)
 * - Complete OG tags: professional social presence
 *
 * @example
 * ```typescript
 * const openGraph = {
 *   title: 'Transform Your Business with AI-Powered Analytics',
 *   description: 'Get real-time insights, automated reporting, and predictive analytics. Start free trial.',
 *   type: 'website',
 *   url: 'https://example.com/product',
 *   image: 'https://example.com/og-image-1200x630.jpg',
 *   imageAlt: 'Dashboard screenshot showing analytics graphs',
 *   siteName: 'Acme Analytics',
 *   locale: 'en_US'
 * }
 * ```
 *
 * @see specs/app/pages/meta/social/open-graph.schema.json
 */
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
    HttpUrlSchema.annotations({
      description: 'Canonical URL for this page',
    })
  ),
  image: Schema.optional(
    HttpUrlSchema.annotations({
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
    HttpUrlSchema.annotations({
      description: 'Video URL if sharing video content',
    })
  ),
  audio: Schema.optional(
    HttpUrlSchema.annotations({
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
