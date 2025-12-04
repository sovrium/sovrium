/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * URL Field
 *
 * Text field with URL format validation. Stores web addresses (URLs) and validates
 * them against standard URL format rules. Supports http://, https://, and other
 * protocols. Can be marked as required, unique, or indexed. URL validation ensures
 * data integrity and prevents malformed URLs from being stored. URLs are stored
 * as plain text strings and can be used for links, API endpoints, and web resources.
 *
 * Business Rules:
 * - URL format validation enforced at application level (protocol + domain + optional path)
 * - Supports multiple protocols: http://, https://, ftp://, etc.
 * - Unique constraint optional - useful for preventing duplicate resource links
 * - Indexing recommended for search and lookup operations on URL fields
 * - Constant value 'url' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'website',
 *   type: 'url',
 *   required: true,
 *   unique: false,
 *   indexed: true,
 *   default: 'https://example.com'
 * }
 * ```
 */
export const UrlFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('url').pipe(
        Schema.annotations({
          description: "Constant value 'url' for type discrimination in discriminated unions",
        })
      ),
      default: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Default URL value when creating new records',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'URL Field',
    description:
      'Text field with URL format validation. Validates web addresses and supports multiple protocols (http://, https://, ftp://, etc.).',
    examples: [
      {
        id: 1,
        name: 'website',
        type: 'url',
        required: true,
        unique: false,
        indexed: true,
      },
      {
        id: 2,
        name: 'profile_url',
        type: 'url',
        required: false,
        default: 'https://example.com/profile',
      },
    ],
  })
)

export type UrlField = Schema.Schema.Type<typeof UrlFieldSchema>
