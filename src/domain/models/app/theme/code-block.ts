/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const CodeBlockConfigSchema = Schema.Struct({
  theme: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        title: 'Code Block Theme',
        description: 'Named Shiki theme for syntax highlighting (e.g., github-dark, github-light)',
        examples: ['github-dark', 'github-light', 'nord', 'dracula'],
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'CodeBlockConfig',
    title: 'Code Block Configuration',
    description: 'Syntax-highlighting theme configuration for markdown fenced code blocks',
  })
)

export type CodeBlockConfig = Schema.Schema.Type<typeof CodeBlockConfigSchema>
