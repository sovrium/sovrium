/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Color Field
 *
 * Stores color values in hexadecimal format (#RRGGBB).
 * Typically rendered with a color picker in the UI.
 * Supports optional default color value.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'brand_color',
 *   type: 'color',
 *   required: true,
 *   default: '#3B82F6'
 * }
 * ```
 */
export const ColorFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('color'),
      default: Schema.optional(
        Schema.String.pipe(
          Schema.pattern(/^#[0-9a-fA-F]{6}$/, {
            message: () => 'Invalid format',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Color Field',
    description: 'Stores color values in hexadecimal format. Rendered with color picker in UI.',
    examples: [
      {
        id: 1,
        name: 'brand_color',
        type: 'color',
        required: true,
        default: '#3B82F6',
      },
    ],
  })
)

export type ColorField = Schema.Schema.Type<typeof ColorFieldSchema>
