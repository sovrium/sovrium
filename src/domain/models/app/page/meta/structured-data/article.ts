/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SchemaOrgContext, schemaType } from './common-fields'

/**
 * Article type
 *
 * 3 article types for different content:
 * - Article: General articles (default, most common)
 * - NewsArticle: News articles (journalistic content, breaking news)
 * - BlogPosting: Blog posts (personal/company blogs, opinion pieces)
 */
export const ArticleTypeSchema = Schema.Literal(
  'Article',
  'NewsArticle',
  'BlogPosting'
).annotations({
  description: 'Article type',
})

/**
 * Article author
 *
 * Author can be either a simple string name or a structured Person/Organization object.
 * - String: Simple author name (e.g., "John Doe")
 * - Object: Structured author with @type (Person/Organization), name, and optional URL
 */
export const ArticleAuthorSchema = Schema.Union(
  Schema.String,
  Schema.Struct({
    '@type': Schema.Literal('Person', 'Organization').annotations({
      description: 'Author type',
    }),
    name: Schema.optional(
      Schema.String.annotations({
        description: 'Author name',
      })
    ),
    url: Schema.optional(
      Schema.String.annotations({
        description: 'Author profile URL',
        format: 'uri',
      })
    ),
  })
).annotations({
  description: 'Article author',
})

/**
 * Publisher logo
 *
 * ImageObject with @type and url for publisher logo.
 * Required for Article structured data to be eligible for rich results.
 */
export const PublisherLogoSchema = Schema.Struct({
  '@type': schemaType('ImageObject'),
  url: Schema.optional(
    Schema.String.annotations({
      description: 'Logo URL',
      format: 'uri',
    })
  ),
}).annotations({
  description: 'Publisher logo',
})

/**
 * Article publisher
 *
 * Organization object representing the content publisher.
 * - @type: "Organization" (required)
 * - name: Publisher name (e.g., "Acme Blog", "TechCrunch")
 * - logo: ImageObject with publisher logo URL
 */
export const ArticlePublisherSchema = Schema.Struct({
  '@type': schemaType('Organization'),
  name: Schema.optional(
    Schema.String.annotations({
      description: 'Publisher name',
    })
  ),
  logo: Schema.optional(PublisherLogoSchema),
}).annotations({
  description: 'Article publisher',
})

/**
 * Schema.org Article structured data
 *
 * Represents articles, news articles, and blog posts for rich results in Google Search.
 * Enables article cards with images, publication dates, and author attribution.
 *
 * Required properties:
 * - @context: "https://schema.org" (Schema.org vocabulary)
 * - @type: Article type (Article, NewsArticle, BlogPosting)
 * - headline: Article title (shown in search results)
 *
 * Optional properties:
 * - description: Article summary/excerpt
 * - image: Article image URL (string) or array of image URLs (for carousel)
 * - author: Author name (string) or structured Person/Organization object
 * - datePublished: Publication date (ISO 8601 format)
 * - dateModified: Last modification date (ISO 8601 format)
 * - publisher: Publishing organization (Organization object with name and logo)
 * - mainEntityOfPage: Canonical URL for the article
 *
 * Article types:
 * - **Article**: General articles, how-to guides, tutorials
 * - **NewsArticle**: Breaking news, journalism (adds publish date prominence)
 * - **BlogPosting**: Personal/company blog posts, opinion pieces
 *
 * SEO impact:
 * - **Rich results**: Article cards with image, headline, date, author in search
 * - **Google News**: NewsArticle eligible for Google News (with additional requirements)
 * - **Author attribution**: Links content to authors (E-E-A-T signals)
 * - **Publisher branding**: Publisher logo and name shown in results
 * - **Freshness signals**: datePublished and dateModified help ranking for time-sensitive queries
 *
 * @example
 * ```typescript
 * const article = {
 *   "@context": "https://schema.org",
 *   "@type": "BlogPosting",
 *   headline: "10 Ways to Boost Productivity",
 *   description: "Proven strategies to improve your daily productivity",
 *   image: "https://example.com/article-image.jpg",
 *   author: {
 *     "@type": "Person",
 *     name: "John Doe",
 *     url: "https://example.com/author/johndoe"
 *   },
 *   datePublished: "2025-01-15T10:00:00Z",
 *   dateModified: "2025-01-20T14:30:00Z",
 *   publisher: {
 *     "@type": "Organization",
 *     name: "Acme Blog",
 *     logo: {
 *       "@type": "ImageObject",
 *       url: "https://example.com/logo.png"
 *     }
 *   },
 *   mainEntityOfPage: "https://example.com/blog/productivity-tips"
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/article.schema.json
 */
export const ArticleSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': ArticleTypeSchema,
  headline: Schema.String.annotations({
    description: 'Article title',
  }),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Article summary',
    })
  ),
  image: Schema.optional(
    Schema.Union(
      Schema.String.annotations({
        description: 'Article image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotations({
          description: 'Article image URL',
          format: 'uri',
        })
      )
    ).annotations({
      description: 'Article image(s)',
    })
  ),
  author: Schema.optional(ArticleAuthorSchema),
  datePublished: Schema.optional(
    Schema.String.annotations({
      description: 'Publication date',
      format: 'date-time',
    })
  ),
  dateModified: Schema.optional(
    Schema.String.annotations({
      description: 'Last modification date',
      format: 'date-time',
    })
  ),
  publisher: Schema.optional(ArticlePublisherSchema),
  mainEntityOfPage: Schema.optional(
    Schema.String.annotations({
      description: "Article's canonical URL",
      format: 'uri',
    })
  ),
}).annotations({
  title: 'Article Schema',
  description: 'Schema.org Article structured data',
})

export type ArticleType = Schema.Schema.Type<typeof ArticleTypeSchema>
export type ArticleAuthor = Schema.Schema.Type<typeof ArticleAuthorSchema>
export type PublisherLogo = Schema.Schema.Type<typeof PublisherLogoSchema>
export type ArticlePublisher = Schema.Schema.Type<typeof ArticlePublisherSchema>
export type Article = Schema.Schema.Type<typeof ArticleSchema>
