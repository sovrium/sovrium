/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

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
      toolbar: Schema.optional(
        Schema.Array(Schema.String).pipe(
          Schema.annotations({
            description:
              'Toolbar actions to display (e.g., bold, italic, link, heading, list, image, code-block, table). When omitted, all actions are available.',
          })
        )
      ),
      placeholder: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Placeholder text displayed when the editor is empty',
          })
        )
      ),
      collaborative: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description: 'Enable real-time collaborative editing via Yjs',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Rich Text Field',
    description:
      'Stores formatted text with rich formatting support. Rendered with Tiptap WYSIWYG editor in UI.',
    examples: [
      {
        id: 1,
        name: 'article_content',
        type: 'rich-text',
        required: true,
        maxLength: 10_000,
        toolbar: ['bold', 'italic', 'link', 'heading', 'list'],
        placeholder: 'Write your article...',
      },
    ],
  })
)

/** @public */
export type RichTextField = Schema.Schema.Type<typeof RichTextFieldSchema>
