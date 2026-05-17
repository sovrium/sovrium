/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * HTTP/HTTPS URL validation schema
 *
 * Validates URLs that start with http:// or https:// protocol.
 * Used for external resources like images, videos, audio, and API endpoints.
 *
 * Validation rules:
 * - Must start with http:// or https://
 * - Follows standard URL format with protocol, domain, and optional path
 * - Format annotated as 'uri' for OpenAPI/JSON Schema compatibility
 *
 * @example "https://example.com/image.jpg"
 * @example "http://api.example.com/endpoint"
 *
 * @see specs/app/pages/common/definitions.schema.json - APP-PAGES-DEFINITIONS-006
 */
export const HttpUrlSchema = Schema.String.pipe(
  Schema.pattern(/^https?:\/\//, {
    message: () => 'URL must start with http:// or https://',
  })
).annotations({
  title: 'HTTP URL',
  description: 'HTTP/HTTPS URL',
  format: 'uri',
})

/** @public */
export type HttpUrl = Schema.Schema.Type<typeof HttpUrlSchema>

/**
 * HTTP/HTTPS URL OR record-template URL string
 *
 * Accepts either:
 *  - a literal http:// or https:// URL (per `HttpUrlSchema`), or
 *  - a string containing one or more `$record.<field>` substitution
 *    tokens which the collection-page renderer resolves to per-record
 *    values BEFORE the URL is emitted to the document.
 *
 * Used by the collection-page metadata path (Open Graph, Twitter, JSON-LD)
 * so a single page declaration can produce a per-record social-sharing URL
 * (`'$record.cover_image'` or `'https://cdn.example.com/$record.cover_image'`)
 * without forcing the schema author to inline a literal URL — see
 * US-PAGES-COLLECTION-PAGES-003 (B-4 dynamic-seo-for-collections).
 *
 * Decode-time validation only checks the string shape (literal URL OR
 * presence of `$record.`); the resolver is responsible for ensuring the
 * post-substitution value is itself a valid URL when it matters.
 *
 * @example "https://example.com/image.jpg"     // literal URL
 * @example "$record.cover_image"               // per-record URL
 * @example "https://cdn.example.com/$record.cover_image"  // templated URL
 */
export const HttpUrlOrRecordTemplateSchema = Schema.String.pipe(
  Schema.pattern(/^https?:\/\/|\$record\./, {
    message: () =>
      'URL must start with http:// or https://, or contain a $record.<field> substitution token',
  })
).annotations({
  title: 'HTTP URL or Record Template',
  description: 'HTTP/HTTPS URL or string containing $record.* substitution token',
  format: 'uri',
})

/** @public */
export type HttpUrlOrRecordTemplate = Schema.Schema.Type<typeof HttpUrlOrRecordTemplateSchema>
