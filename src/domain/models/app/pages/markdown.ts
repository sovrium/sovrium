/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Table of Contents ───────────────────────────────────────────────────────

/**
 * Table of contents configuration for markdown pages.
 */
const MarkdownTocSchema = Schema.Struct({
  /** Maximum heading depth to include in the TOC */
  maxDepth: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 6 })),
      Schema.annotate({ description: 'Maximum heading depth to include (1-6)' })
    )
  ),

  /** Position of the TOC relative to the content */
  position: Schema.optional(
    Schema.Literals(['top', 'sidebar']).pipe(
      Schema.annotate({ description: 'TOC placement: inline at top or in a sidebar' })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'MarkdownToc',
    title: 'Table of Contents',
    description: 'Configuration for automatic table of contents generation',
  })
)

// ─── Markdown Page Mode ──────────────────────────────────────────────────────

/**
 * Markdown page mode configuration.
 *
 * Enables markdown-driven content for a page, either inline or from a file.
 * Supports layout modes, frontmatter variables, and table of contents.
 *
 * @example
 * ```typescript
 * // Inline content
 * markdown: { content: '# Hello\n\nWelcome to the page.', layout: 'prose' }
 *
 * // File-based content
 * markdown: { file: 'content/docs.md', layout: 'prose' }
 *
 * // With table of contents
 * markdown: { file: 'content/docs.md', layout: 'docs', toc: { maxDepth: 3 } }
 *
 * // Layout only (used with contentDir)
 * markdown: { layout: 'prose' }
 * ```
 */
export const MarkdownSchema = Schema.Struct({
  /** Inline markdown content string */
  content: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Inline markdown content' }))
  ),

  /** Path to a markdown file relative to the project root */
  file: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ description: 'Path to a markdown file (e.g., content/docs.md)' })
    )
  ),

  /** Layout mode for rendering the markdown content */
  layout: Schema.optional(
    Schema.Literals(['prose', 'docs', 'full', 'none']).pipe(
      Schema.annotate({
        description:
          'Layout mode: prose (article-width), docs (with sidebar), full (full-width), none (no wrapper)',
      })
    )
  ),

  /** Table of contents configuration */
  toc: Schema.optional(MarkdownTocSchema),
}).pipe(
  Schema.annotate({
    identifier: 'Markdown',
    title: 'Markdown Page Mode',
    description: 'Markdown-driven content configuration for a page',
  })
)

/** @public */
export type Markdown = Schema.Schema.Type<typeof MarkdownSchema>

// Re-export ContentDir from dedicated module
export { ContentDirSchema, type ContentDir } from './content-dir'
