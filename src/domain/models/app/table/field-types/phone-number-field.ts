/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Phone Number Field
 *
 * Text field designed for storing phone numbers with optional format validation.
 * Stores phone numbers as plain text strings, supporting international formats
 * and various notation styles. Can be marked as required, unique (for preventing
 * duplicate registrations), or indexed for fast lookups. No automatic formatting
 * is applied - numbers are stored exactly as entered.
 *
 * Business Rules:
 * - Phone numbers stored as text strings to preserve original formatting (spaces, dashes, parentheses)
 * - No automatic validation applied - allows flexibility for international formats
 * - Unique constraint useful for preventing duplicate user registrations
 * - Indexing recommended for user lookup and search operations
 * - Constant value 'phone-number' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'mobile_phone',
 *   type: 'phone-number',
 *   required: true,
 *   unique: true,
 *   indexed: true,
 *   default: '+1 (555) 000-0000'
 * }
 * ```
 */
export const PhoneNumberFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('phone-number').pipe(
        Schema.annotations({
          description:
            "Constant value 'phone-number' for type discrimination in discriminated unions",
        })
      ),
      default: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Default phone number value when creating new records',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Phone Number Field',
    description:
      'Text field for storing phone numbers with support for international formats. Numbers are stored as plain text without automatic formatting.',
    examples: [
      {
        id: 1,
        name: 'mobile_phone',
        type: 'phone-number',
        required: true,
        unique: true,
        indexed: true,
      },
      {
        id: 2,
        name: 'office_phone',
        type: 'phone-number',
        required: false,
        default: '+1 (555) 000-0000',
      },
    ],
  })
)

export type PhoneNumberField = Schema.Schema.Type<typeof PhoneNumberFieldSchema>
