/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

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
