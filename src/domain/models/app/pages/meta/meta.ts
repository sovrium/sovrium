/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AnalyticsSchema } from './analytics'
import { CustomElementsSchema } from './custom-elements'
import { DnsPrefetchSchema } from './dns-prefetch'
import { FaviconSchema, FaviconSetSchema, FaviconsConfigSchema } from './favicon'
import { OpenGraphSchema } from './open-graph'
import { PreloadSchema } from './preload'
import { TwitterCardSchema } from './twitter'

// Re-export all section schemas and types

// ============================================================================
// Meta Schema (Main Export)
// ============================================================================

/**
 * Language code format
 *
 * ISO 639-1 language code with optional ISO 3166-1 country code.
 */
export const LanguageCodeSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[a-z]{2}(-[A-Z]{2})?$/, {
      message:
        'Language code must be ISO 639-1 format with optional country (e.g., en, en-US, fr-FR, es-ES)',
    })
  )
).annotate({
  description: 'Page language code (ISO 639-1 with optional country)',
  examples: ['en-US', 'fr-FR', 'es-ES', 'de-DE'],
})

/**
 * Comprehensive page metadata
 *
 * Master orchestrator schema that combines all meta categories into a single configuration.
 * Provides comprehensive SEO, social media, structured data, performance, and analytics
 * capabilities for optimal web presence.
 */
export const MetaSchema = Schema.Struct({
  lang: Schema.optional(
    LanguageCodeSchema.annotate({
      description: 'Page language code (optional - uses auto-detection if not specified)',
    })
  ),
  title: Schema.String.pipe(Schema.check(Schema.isMaxLength(60))).annotate({
    description: 'Page title for browser tab and SEO (max 60 characters for optimal display)',
  }),
  description: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(160))).annotate({
      description: 'Page description for SEO and social sharing (max 160 characters)',
    })
  ),
  keywords: Schema.optional(
    Schema.String.annotate({
      description: 'Comma-separated keywords for SEO',
    })
  ),
  author: Schema.optional(
    Schema.String.annotate({
      description: 'Page author or organization name',
    })
  ),
  canonical: Schema.optional(
    Schema.String.annotate({
      description: 'Canonical URL to prevent duplicate content issues',
      format: 'uri',
    })
  ),
  robots: Schema.optional(
    Schema.String.annotate({
      description: 'Robot directives (e.g., noindex, nofollow, noindex, nofollow)',
    })
  ),
  noindex: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Prevent indexing by search engines (shorthand for robots: noindex)',
    })
  ),
  favicon: Schema.optional(FaviconSchema),
  favicons: Schema.optional(
    Schema.Union([FaviconSetSchema, FaviconsConfigSchema]).annotate({
      description:
        'Icons for this page, in either of two forms: an explicit set naming each size and file, or the generated form that derives every size from one source image.',
    })
  ),
  stylesheet: Schema.optional(
    Schema.String.annotate({
      description: 'Path to the main stylesheet',
    })
  ),
  googleFonts: Schema.optional(
    Schema.String.annotate({
      description: 'Google Fonts URL',
      format: 'uri',
    })
  ),
  openGraph: Schema.optional(OpenGraphSchema),
  twitter: Schema.optional(TwitterCardSchema),
  schema: Schema.optionalKey(
    // `Schema.Unknown` discards its own annotations when emitted to JSON
    // Schema, so the description rides on the `UndefinedOr` wrapper that
    // `Schema.optional` would have built anyway.
    Schema.UndefinedOr(Schema.Unknown).annotate({
      description:
        'Schema.org structured data describing this page, either in the shorthand form (organization, faqPage, …) or as a full Schema.org object.',
    })
  ),
  preload: Schema.optional(PreloadSchema),
  dnsPrefetch: Schema.optional(DnsPrefetchSchema),
  analytics: Schema.optional(
    Schema.Union([Schema.Record(Schema.String, Schema.Unknown), AnalyticsSchema]).annotate({
      description:
        'Analytics loaded on this page: the `providers` form, or a free-form object passed through for a provider the schema does not model.',
    })
  ),
  customElements: Schema.optional(CustomElementsSchema),
  // Aliases for test compatibility
  twitterCard: Schema.optional(TwitterCardSchema),
  structuredData: Schema.optionalKey(
    Schema.UndefinedOr(Schema.Unknown).annotate({
      description: 'Alias of `schema`, kept for configs written against the older name.',
    })
  ),
  'og:site_name': Schema.optional(
    Schema.String.annotate({
      description: 'OpenGraph site name (shorthand for openGraph.siteName)',
    })
  ),
  // Internationalization for metadata
  i18n: Schema.optional(
    Schema.Record(
      LanguageCodeSchema,
      Schema.Struct({
        title: Schema.optional(
          Schema.String.pipe(Schema.check(Schema.isMaxLength(60))).annotate({
            description: 'Translated page title (max 60 characters)',
          })
        ),
        description: Schema.optional(
          Schema.String.pipe(Schema.check(Schema.isMaxLength(160))).annotate({
            description: 'Translated page description (max 160 characters)',
          })
        ),
      })
    ).annotate({
      description: 'Localized metadata translations per language',
    })
  ),
}).annotate({
  title: 'Page Metadata',
  description:
    'Comprehensive page metadata including SEO, social media, structured data, performance, and analytics',
})

/** @public */
export type LanguageCode = Schema.Schema.Type<typeof LanguageCodeSchema>
export type Meta = Schema.Schema.Type<typeof MetaSchema>
