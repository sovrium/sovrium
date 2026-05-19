/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const DESCRIPTION_MAX_LENGTH = 2000

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

export type Description = Schema.Schema.Type<typeof DescriptionSchema>

export type DescriptionEncoded = Schema.Schema.Encoded<typeof DescriptionSchema>
