/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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

export type HttpUrl = Schema.Schema.Type<typeof HttpUrlSchema>
