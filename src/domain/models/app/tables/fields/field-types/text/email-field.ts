/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const EmailFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('email').pipe(
        Schema.annotations({
          description: "Constant value 'email' for type discrimination in discriminated unions",
        })
      ),
      default: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Default email address when creating new records',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Email Field',
    description:
      'Text field with email format validation (RFC 5322). Validates email addresses and prevents invalid formats from being stored.',
    examples: [
      {
        id: 1,
        name: 'email',
        type: 'email',
        required: true,
        unique: true,
        indexed: true,
      },
      {
        id: 2,
        name: 'contact_email',
        type: 'email',
        required: false,
        default: 'contact@example.com',
      },
    ],
  })
)

export type EmailField = Schema.Schema.Type<typeof EmailFieldSchema>
