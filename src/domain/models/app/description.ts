/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Maximum length for application descriptions.
 * This limit prevents UI/database issues with very long descriptions.
 */
const DESCRIPTION_MAX_LENGTH = 500

/**
 * DescriptionSchema defines validation rules for application descriptions.
 *
 * Application descriptions must be single-line strings:
 * - No line breaks allowed (\n, \r, or \r\n)
 * - Maximum 500 characters
 * - Can contain any characters except line breaks
 * - Empty strings are allowed
 * - Unicode characters and emojis are supported
 * - Special characters, spaces, and tabs are allowed
 *
 * @example
 * ```typescript
 * // Valid descriptions
 * const desc1 = 'A simple application'
 * const desc2 = 'My app - with special characters!@#$%'
 * const desc3 = 'Très bien! 你好 🎉'
 * const desc4 = ''
 *
 * // Invalid descriptions (contain line breaks or too long)
 * const invalid1 = 'Multi\nline'          // ❌ Contains \n
 * const invalid2 = 'Windows\r\nbreak'     // ❌ Contains \r\n
 * const invalid3 = 'Mac\rbreak'           // ❌ Contains \r
 * const invalid4 = 'x'.repeat(501)        // ❌ Exceeds 500 characters
 *
 * // Validate description
 * const validated = Schema.decodeUnknownSync(DescriptionSchema)(desc1)
 * ```
 */
export const DescriptionSchema = Schema.String.pipe(
  Schema.pattern(/^[^\r\n]*$/, {
    message: () => 'Description must be a single line (line breaks are not allowed)',
  }),
  Schema.maxLength(DESCRIPTION_MAX_LENGTH, {
    message: () =>
      `Description must be ${DESCRIPTION_MAX_LENGTH} characters or less (current length exceeds limit)`,
  }),
  Schema.annotations({
    title: 'Application Description',
    description: `A single-line description of the application (max ${DESCRIPTION_MAX_LENGTH} characters, no line breaks)`,
    examples: [
      'A simple application',
      'My app - with special characters!@#$%',
      'Très bien! 你好 🎉',
      'Full-featured e-commerce platform with cart, checkout & payment processing',
    ],
  })
)

/**
 * TypeScript type inferred from DescriptionSchema.
 *
 * Use this type for type-safe access to validated description strings.
 *
 * @example
 * ```typescript
 * const description: Description = 'A simple application'
 * ```
 */
export type Description = Schema.Schema.Type<typeof DescriptionSchema>

/**
 * Encoded type of DescriptionSchema (what goes in).
 *
 * In this case, it's the same as Description since we don't use transformations.
 */
export type DescriptionEncoded = Schema.Schema.Encoded<typeof DescriptionSchema>
