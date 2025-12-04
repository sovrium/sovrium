/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Single Line Text Field
 *
 * Short text input limited to a single line. Ideal for names, titles, labels,
 * and brief identifiers. Text is stored as-is without formatting. Required flag
 * makes the field mandatory. Unique constraint ensures no duplicate values across
 * records. Indexing improves search and filter performance on this field.
 *
 * Business Rules:
 * - Single-line constraint prevents multi-line input, ensuring consistent formatting and UI display
 * - Text is stored without formatting, preserving raw input for maximum flexibility
 * - Constant value 'single-line-text' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'title',
 *   type: 'single-line-text',
 *   required: true,
 *   unique: false,
 *   indexed: true,
 *   default: 'Untitled'
 * }
 * ```
 */
export const SingleLineTextFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('single-line-text').pipe(
        Schema.annotations({
          description:
            "Constant value 'single-line-text' for type discrimination in discriminated unions",
        })
      ),
      default: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Default value for this field when creating new records',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Single Line Text Field',
    description:
      'Short text input limited to a single line. Ideal for names, titles, labels, and brief identifiers. Text is stored as-is without formatting.',
    examples: [
      {
        id: 1,
        name: 'title',
        type: 'single-line-text',
        required: true,
        unique: false,
        indexed: true,
        default: 'Untitled',
      },
      {
        id: 2,
        name: 'first_name',
        type: 'single-line-text',
        required: true,
      },
    ],
  })
)

export type SingleLineTextField = Schema.Schema.Type<typeof SingleLineTextFieldSchema>
