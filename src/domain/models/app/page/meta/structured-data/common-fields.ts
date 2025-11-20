/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Common Schema.org field definitions
 *
 * This module provides reusable field definitions that are shared across multiple
 * structured data schemas. Using these common fields ensures consistency in:
 * - Validation rules (e.g., email format, URI format)
 * - Annotations (descriptions, formats)
 * - Type definitions
 *
 * Benefits:
 * - **DRY principle**: Single source of truth for common field patterns
 * - **Consistency**: Same validation rules across all schemas
 * - **Maintainability**: Update field definition in one place
 * - **Type safety**: Reusable schema types
 *
 * Usage:
 * ```typescript
 * import { SchemaOrgContext, SchemaOrgEmail, SchemaOrgTelephone } from './common-fields'
 *
 * export const PersonSchema = Schema.Struct({
 *   '@context': SchemaOrgContext,
 *   email: Schema.optional(SchemaOrgEmail),
 *   telephone: Schema.optional(SchemaOrgTelephone),
 *   // ... other fields
 * })
 * ```
 */

/**
 * Schema.org @context field
 *
 * Required in all Schema.org structured data to indicate the vocabulary being used.
 * Always set to "https://schema.org" for Schema.org compliance.
 *
 * Used in: Person, Organization, LocalBusiness, Product, Article, Breadcrumb, FAQPage, EducationEvent
 */
export const SchemaOrgContext = Schema.Literal('https://schema.org').annotations({
  description: 'Schema.org context',
})

/**
 * Email address field
 *
 * Validates email format according to RFC 5322.
 * Used for contact information in Person, Organization, and LocalBusiness schemas.
 *
 * Used in: Person, Organization, LocalBusiness
 */
export const SchemaOrgEmail = Schema.String.annotations({
  description: 'Email address',
  format: 'email',
})

/**
 * Telephone number field
 *
 * Stores telephone number as a string to support international formats.
 * No format validation to allow flexibility (e.g., +1-555-123-4567, (555) 123-4567, etc.)
 *
 * Used in: Person, Organization, LocalBusiness
 */
export const SchemaOrgTelephone = Schema.String.annotations({
  description: 'Phone number',
})

/**
 * Array of social media profile URLs
 *
 * The "sameAs" property links an entity to its social media profiles for verification.
 * Each URL should be a valid URI pointing to an official social media account.
 *
 * Common platforms: Twitter, LinkedIn, Facebook, GitHub, Instagram, YouTube
 *
 * SEO impact:
 * - Verifies entity's online identity across platforms
 * - Helps search engines understand the entity's social presence
 * - May appear in Knowledge Graph panels
 *
 * Used in: Person, Organization, LocalBusiness
 */
export const SchemaOrgSameAs = Schema.Array(
  Schema.String.annotations({
    description: 'Social media profile URL',
    format: 'uri',
  })
).annotations({
  description: 'Social media profile URLs',
  examples: [
    [
      'https://twitter.com/example',
      'https://linkedin.com/in/example',
      'https://facebook.com/example',
    ],
  ],
})

/**
 * URL field for web resources
 *
 * Validates URI format and is used for various web resource references:
 * - Personal/organization website
 * - Product pages
 * - Profile URLs
 * - Image URLs
 *
 * Used in: Person, Organization, LocalBusiness, Product, Article
 */
export const SchemaOrgUrl = Schema.String.annotations({
  description: 'URL',
  format: 'uri',
})

/**
 * Image URL field
 *
 * URL to an image resource (JPEG, PNG, WebP, etc.).
 * Used for photos, logos, product images, etc.
 *
 * SEO impact:
 * - Displayed in search result cards
 * - Shown in Knowledge Graph panels
 * - Used in rich results (products, articles, etc.)
 *
 * Used in: Person, Organization, LocalBusiness, Product, Article
 */
export const SchemaOrgImageUrl = Schema.String.annotations({
  description: 'Image URL',
  format: 'uri',
})

/**
 * Helper: Create optional field
 *
 * Utility function to wrap a schema in Schema.optional() while preserving type inference.
 * Reduces boilerplate when defining optional fields.
 *
 * @example
 * ```typescript
 * // Instead of:
 * email: Schema.optional(SchemaOrgEmail),
 *
 * // You can use:
 * email: optional(SchemaOrgEmail),
 * ```
 */
export const optional = <A, I, R>(schema: Schema.Schema<A, I, R>) => Schema.optional(schema)
