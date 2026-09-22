/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { positiveInt, schemaType, SchemaOrgContext } from './structured-data-vocabulary'

// ============================================================================
// Structured Data — Article
// ============================================================================

/**
 * Article type
 */
export const ArticleTypeSchema = Schema.Literals([
  'Article',
  'NewsArticle',
  'BlogPosting',
]).annotate({
  description: 'Article type',
})

/**
 * Article author
 */
export const ArticleAuthorSchema = Schema.Union([
  Schema.String,
  Schema.Struct({
    '@type': Schema.Literals(['Person', 'Organization']).annotate({
      description: 'Author type',
    }),
    name: Schema.optional(
      Schema.String.annotate({
        description: 'Author name',
      })
    ),
    url: Schema.optional(
      Schema.String.annotate({
        description: 'Author profile URL',
        format: 'uri',
      })
    ),
  }),
]).annotate({
  description: 'Article author',
})

/**
 * Publisher logo
 */
export const PublisherLogoSchema = Schema.Struct({
  '@type': schemaType('ImageObject'),
  url: Schema.optional(
    Schema.String.annotate({
      description: 'Logo URL',
      format: 'uri',
    })
  ),
}).annotate({
  description: 'Publisher logo',
})

/**
 * Article publisher
 */
export const ArticlePublisherSchema = Schema.Struct({
  '@type': schemaType('Organization'),
  name: Schema.optional(
    Schema.String.annotate({
      description: 'Publisher name',
    })
  ),
  logo: Schema.optional(PublisherLogoSchema),
}).annotate({
  description: 'Article publisher',
})

/**
 * Schema.org Article structured data
 */
export const ArticleSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': ArticleTypeSchema,
  headline: Schema.String.annotate({
    description: 'Article title',
  }),
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Article summary',
    })
  ),
  image: Schema.optional(
    Schema.Union([
      Schema.String.annotate({
        description: 'Article image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotate({
          description: 'Article image URL',
          format: 'uri',
        })
      ),
    ]).annotate({
      description: 'Article image(s)',
    })
  ),
  author: Schema.optional(ArticleAuthorSchema),
  datePublished: Schema.optional(
    Schema.String.annotate({
      description: 'Publication date',
      format: 'date-time',
    })
  ),
  dateModified: Schema.optional(
    Schema.String.annotate({
      description: 'Last modification date',
      format: 'date-time',
    })
  ),
  publisher: Schema.optional(ArticlePublisherSchema),
  mainEntityOfPage: Schema.optional(
    Schema.String.annotate({
      description: "Article's canonical URL",
      format: 'uri',
    })
  ),
}).annotate({
  title: 'Article Schema',
  description: 'Schema.org Article structured data',
})

/** @public */
export type ArticleType = Schema.Schema.Type<typeof ArticleTypeSchema>
/** @public */
export type ArticleAuthor = Schema.Schema.Type<typeof ArticleAuthorSchema>
/** @public */
export type PublisherLogo = Schema.Schema.Type<typeof PublisherLogoSchema>
/** @public */
export type ArticlePublisher = Schema.Schema.Type<typeof ArticlePublisherSchema>
/** @public */
export type Article = Schema.Schema.Type<typeof ArticleSchema>

// ============================================================================
// Structured Data — Breadcrumb
// ============================================================================

/**
 * Breadcrumb list item
 */
export const BreadcrumbListItemSchema = Schema.Struct({
  '@type': schemaType('ListItem'),
  position: positiveInt('Item position in breadcrumb trail'),
  name: Schema.String.annotate({
    description: 'Breadcrumb label',
  }),
  item: Schema.optional(
    Schema.String.annotate({
      description: 'URL to the breadcrumb page',
      format: 'uri',
    })
  ),
}).annotate({
  description: 'Breadcrumb list item',
})

/**
 * Schema.org BreadcrumbList structured data
 */
export const BreadcrumbSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('BreadcrumbList'),
  itemListElement: Schema.Array(BreadcrumbListItemSchema).annotate({
    description: 'Array of breadcrumb items',
  }),
}).annotate({
  title: 'Breadcrumb Schema',
  description: 'Schema.org BreadcrumbList structured data',
})

/** @public */
export type BreadcrumbListItem = Schema.Schema.Type<typeof BreadcrumbListItemSchema>
/** @public */
export type Breadcrumb = Schema.Schema.Type<typeof BreadcrumbSchema>

// ============================================================================
// Structured Data — FAQ Page
// ============================================================================

/**
 * FAQ answer
 */
export const FaqAnswerSchema = Schema.Struct({
  '@type': schemaType('Answer'),
  text: Schema.String.annotate({
    description: 'The answer text',
  }),
}).annotate({
  description: 'FAQ answer',
})

/**
 * FAQ question with accepted answer
 */
export const FaqQuestionSchema = Schema.Struct({
  '@type': schemaType('Question'),
  name: Schema.String.annotate({
    description: 'The question text',
  }),
  acceptedAnswer: FaqAnswerSchema,
}).annotate({
  description: 'FAQ question',
})

/**
 * Schema.org FAQPage structured data
 */
export const FaqPageSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('FAQPage'),
  mainEntity: Schema.Array(FaqQuestionSchema).annotate({
    description: 'Array of questions and answers',
  }),
}).annotate({
  title: 'FAQ Page Schema',
  description: 'Schema.org FAQPage structured data',
})

/** @public */
export type FaqAnswer = Schema.Schema.Type<typeof FaqAnswerSchema>
/** @public */
export type FaqQuestion = Schema.Schema.Type<typeof FaqQuestionSchema>
/** @public */
export type FaqPage = Schema.Schema.Type<typeof FaqPageSchema>
