/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Long Text Field
 *
 * Multi-line text input for paragraphs, descriptions, notes, and comments.
 * Supports line breaks and longer content. Text is stored as-is without rich
 * formatting (no bold, italics, etc.). Required flag makes the field mandatory.
 * Indexing improves search performance but may be slower for very long content.
 * `fullTextSearch` makes the field searchable by word from a full-text index:
 * on a table declaring one, `?q=` and a `searchEngine: 'fts'` search box search
 * the declared fields only, ranked.
 *
 * Business Rules:
 * - Multi-line support allows paragraphs and extended content while preserving line breaks
 * - Text is stored without formatting, focusing on plain text content
 * - Indexing optional due to performance trade-offs with large text content
 * - `fullTextSearch` switches `?q=` from a substring match to a ranked word search
 * - Constant value 'long-text' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'description',
 *   type: 'long-text',
 *   required: true,
 *   indexed: false,
 *   default: 'Enter description here...'
 * }
 * ```
 */
export const LongTextFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('long-text').pipe(
      Schema.annotate({
        description: "Constant value 'long-text' for type discrimination in discriminated unions",
      })
    ),
    default: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Default value for this field when creating new records',
        })
      )
    ),
    fullTextSearch: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description:
            "Make this field searchable by word from a full-text index kept on both SQLite and PostgreSQL. On a table declaring at least one such field, the records endpoint's `q` parameter and a `searchEngine: 'fts'` search box search the declared fields only: every word must appear in the field, each matching the start of a word, a double-quoted span is a phrase, case is ignored, and matches come most relevant first unless a sort is given. A table declaring none keeps the substring search over all its text fields.",
          defaultNote: 'false — matched by `q` as a substring, like the other text fields',
        })
      )
    ),
  }),
  Schema.annotate({
    title: 'Long Text Field',
    description:
      'Multi-line text input for paragraphs, descriptions, notes, and comments. Supports line breaks and longer content without rich formatting.',
    examples: [
      {
        id: 1,
        name: 'description',
        type: 'long-text',
        required: true,
        indexed: false,
        default: 'Enter description here...',
      },
      {
        id: 2,
        name: 'notes',
        type: 'long-text',
        required: false,
      },
      {
        id: 3,
        name: 'body',
        type: 'long-text',
        fullTextSearch: true,
      },
    ],
  })
)

/** @public */
export type LongTextField = Schema.Schema.Type<typeof LongTextFieldSchema>
