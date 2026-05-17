/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * Code Field
 *
 * Stores source code as plain text with syntax highlighting metadata.
 * Rendered with a CodeMirror 6 editor in the UI.
 * Requires a programming language for syntax highlighting.
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'source_code',
 *   type: 'code',
 *   language: 'javascript',
 *   lineNumbers: true,
 *   tabSize: 2
 * }
 * ```
 */
export const CodeFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('code'),
      language: Schema.String.pipe(
        Schema.annotations({
          description:
            'Programming language for syntax highlighting (e.g., javascript, typescript, yaml, json, python, sql, html, css, markdown)',
        })
      ),
      lineNumbers: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description: 'Show line numbers in the editor',
          })
        )
      ),
      readOnly: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description: 'Make the editor read-only',
          })
        )
      ),
      minLines: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({
            description: 'Minimum visible lines in the editor',
          })
        )
      ),
      maxLines: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.annotations({
            description: 'Maximum visible lines before scrolling',
          })
        )
      ),
      tabSize: Schema.optional(
        Schema.Int.pipe(
          Schema.greaterThanOrEqualTo(1),
          Schema.lessThanOrEqualTo(8),
          Schema.annotations({
            description: 'Tab size in spaces (1-8, default: 2)',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Code Field',
    description:
      'Stores source code as plain text with syntax highlighting. Rendered with CodeMirror 6 editor in UI.',
    examples: [
      {
        id: 1,
        name: 'source_code',
        type: 'code',
        language: 'javascript',
        lineNumbers: true,
        tabSize: 2,
      },
    ],
  })
)

/** @public */
export type CodeField = Schema.Schema.Type<typeof CodeFieldSchema>
