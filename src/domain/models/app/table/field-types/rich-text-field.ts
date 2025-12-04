/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

/**
 * Rich Text Field
 *
 * Stores formatted text with support for bold, italic, links, lists, and other rich formatting.
 * Typically rendered with a WYSIWYG editor in the UI.
 * Supports optional maximum length constraints.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'article_content',
 *   type: 'rich-text',
 *   required: true,
 *   maxLength: 10000
 * }
 * ```
 */
export const RichTextFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('rich-text'),
      maxLength: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({
            description: 'Maximum length in characters',
          })
        )
      ),
      fullTextSearch: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description: 'Enable full-text search indexing for this field',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Rich Text Field',
    description:
      'Stores formatted text with rich formatting support. Rendered with WYSIWYG editor in UI.',
    examples: [
      {
        id: 1,
        name: 'article_content',
        type: 'rich-text',
        required: true,
        maxLength: 10_000,
      },
    ],
  })
)

export type RichTextField = Schema.Schema.Type<typeof RichTextFieldSchema>
