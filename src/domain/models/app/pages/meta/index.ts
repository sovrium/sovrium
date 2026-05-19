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

export * from './analytics'
export * from './custom-elements'
export * from './dns-prefetch'
export * from './favicon'
export * from './open-graph'
export * from './preload'
export * from './structured-data'
export * from './twitter'


export const LanguageCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: () =>
      'Language code must be ISO 639-1 format with optional country (e.g., en, en-US, fr-FR, es-ES)',
  })
).annotations({
  description: 'Page language code (ISO 639-1 with optional country)',
  examples: ['en-US', 'fr-FR', 'es-ES', 'de-DE'],
})

export const MetaSchema = Schema.Struct({
  lang: Schema.optional(
    LanguageCodeSchema.annotations({
      description: 'Page language code (optional - uses auto-detection if not specified)',
    })
  ),
  title: Schema.String.pipe(Schema.maxLength(60)).annotations({
    description: 'Page title for browser tab and SEO (max 60 characters for optimal display)',
  }),
  description: Schema.optional(
    Schema.String.pipe(Schema.maxLength(160)).annotations({
      description: 'Page description for SEO and social sharing (max 160 characters)',
    })
  ),
  keywords: Schema.optional(
    Schema.String.annotations({
      description: 'Comma-separated keywords for SEO',
    })
  ),
  author: Schema.optional(
    Schema.String.annotations({
      description: 'Page author or organization name',
    })
  ),
  canonical: Schema.optional(
    Schema.String.annotations({
      description: 'Canonical URL to prevent duplicate content issues',
      format: 'uri',
    })
  ),
  robots: Schema.optional(
    Schema.String.annotations({
      description: 'Robot directives (e.g., noindex, nofollow, noindex, nofollow)',
    })
  ),
  noindex: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Prevent indexing by search engines (shorthand for robots: noindex)',
    })
  ),
  priority: Schema.optional(
    Schema.Number.pipe(Schema.between(0, 1)).annotations({
      description: 'Sitemap priority (0.0 to 1.0) for search engine crawling hints',
    })
  ),
  changefreq: Schema.optional(
    Schema.Literal('always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never').annotations(
      {
        description: 'Sitemap change frequency hint for search engines',
      }
    )
  ),
  favicon: Schema.optional(FaviconSchema),
  favicons: Schema.optional(Schema.Union(FaviconSetSchema, FaviconsConfigSchema)),
  stylesheet: Schema.optional(
    Schema.String.annotations({
      description: 'Path to the main stylesheet',
    })
  ),
  googleFonts: Schema.optional(
    Schema.String.annotations({
      description: 'Google Fonts URL',
      format: 'uri',
    })
  ),
  socialImage: Schema.optional(
    Schema.String.annotations({
      description: 'Default image for social media sharing',
      format: 'uri',
    })
  ),
  openGraph: Schema.optional(OpenGraphSchema),
  twitter: Schema.optional(TwitterCardSchema),
  schema: Schema.optional(
    Schema.Unknown.annotations({
      description:
        'Schema.org structured data - accepts orchestrator format (organization, faqPage, etc.) or direct Schema.org object (@context, @type, ...)',
    })
  ),
  preload: Schema.optional(PreloadSchema),
  dnsPrefetch: Schema.optional(DnsPrefetchSchema),
  analytics: Schema.optional(
    Schema.Union(Schema.Record({ key: Schema.String, value: Schema.Unknown }), AnalyticsSchema)
  ),
  customElements: Schema.optional(CustomElementsSchema),
  viewport: Schema.optional(
    Schema.String.annotations({
      description:
        'Viewport meta tag content (e.g., "width=device-width, initial-scale=1.0") for responsive design',
    })
  ),
  twitterCard: Schema.optional(TwitterCardSchema),
  structuredData: Schema.optional(Schema.Unknown),
  'og:site_name': Schema.optional(
    Schema.String.annotations({
      description: 'OpenGraph site name (shorthand for openGraph.siteName)',
    })
  ),
  i18n: Schema.optional(
    Schema.Record({
      key: LanguageCodeSchema,
      value: Schema.Struct({
        title: Schema.optional(
          Schema.String.pipe(Schema.maxLength(60)).annotations({
            description: 'Translated page title (max 60 characters)',
          })
        ),
        description: Schema.optional(
          Schema.String.pipe(Schema.maxLength(160)).annotations({
            description: 'Translated page description (max 160 characters)',
          })
        ),
      }),
    }).annotations({
      description: 'Localized metadata translations per language',
    })
  ),
}).annotations({
  title: 'Page Metadata',
  description:
    'Comprehensive page metadata including SEO, social media, structured data, performance, and analytics',
})

export type LanguageCode = Schema.Schema.Type<typeof LanguageCodeSchema>
export type Meta = Schema.Schema.Type<typeof MetaSchema>
