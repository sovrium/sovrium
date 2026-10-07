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
 * @see [internal ref] - a pages definitions spec
 */
export const HttpUrlSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^https?:\/\//, {
      message: 'URL must start with http:// or https://',
    })
  )
).annotate({
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
 * the pages collection pages requirement (B-4 dynamic-seo-for-collections).
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
  Schema.check(
    Schema.isPattern(/^https?:\/\/|\$record\./, {
      message:
        'URL must start with http:// or https://, or contain a $record.<field> substitution token',
    })
  )
).annotate({
  title: 'HTTP URL or Record Template',
  description: 'HTTP/HTTPS URL or string containing $record.* substitution token',
  format: 'uri',
})

/**
 * A sharing-image address: an HTTP/HTTPS URL, a `$record.<field>` template, a
 * `$t:` translation key (one image per language), or a site path starting with
 * a single `/`.
 *
 * A social network fetches the image with no page around it, so a path is
 * emitted as a full address on the host the request arrived on — the renderer
 * owns that step. A protocol-relative `//host/x` is refused: it names another
 * host without saying which scheme.
 *
 * @example "https://example.com/card.png"
 * @example "/og-en.png"
 * @example "$t:og.image"
 */
export const SharingImageAddressSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^https?:\/\/|\$record\.|^\$t:|^\/(?!\/)/, {
      message:
        'URL must start with http:// or https:// or a single /, be a $t: translation key, or contain a $record.<field> substitution token',
    })
  )
).annotate({
  title: 'Sharing image address',
  description:
    'HTTP/HTTPS URL, a path starting with /, a $t: translation key, or a string containing a $record.* substitution token',
})

/** @public */
export type HttpUrlOrRecordTemplate = Schema.Schema.Type<typeof HttpUrlOrRecordTemplateSchema>
