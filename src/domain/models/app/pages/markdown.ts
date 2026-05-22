/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


const MarkdownTocSchema = Schema.Struct({
  maxDepth: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(1, 6),
      Schema.annotations({ description: 'Maximum heading depth to include (1-6)' })
    )
  ),

  position: Schema.optional(
    Schema.Literal('top', 'sidebar').pipe(
      Schema.annotations({ description: 'TOC placement: inline at top or in a sidebar' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'MarkdownToc',
    title: 'Table of Contents',
    description: 'Configuration for automatic table of contents generation',
  })
)


export const MarkdownSchema = Schema.Struct({
  content: Schema.optional(
    Schema.String.pipe(Schema.annotations({ description: 'Inline markdown content' }))
  ),

  file: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Path to a markdown file (e.g., content/docs.md)' })
    )
  ),

  layout: Schema.optional(
    Schema.Literal('prose', 'docs', 'full', 'none').pipe(
      Schema.annotations({
        description:
          'Layout mode: prose (article-width), docs (with sidebar), full (full-width), none (no wrapper)',
      })
    )
  ),

  toc: Schema.optional(MarkdownTocSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Markdown',
    title: 'Markdown Page Mode',
    description: 'Markdown-driven content configuration for a page',
  })
)

export type Markdown = Schema.Schema.Type<typeof MarkdownSchema>

export { ContentDirSchema, type ContentDir } from './content-dir'
