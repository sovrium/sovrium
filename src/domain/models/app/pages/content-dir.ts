/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Content Directory Collection ────────────────────────────────────────────

/**
 * Content directory sort configuration.
 */
const ContentDirSortSchema = Schema.Struct({
  /** Frontmatter field to sort by */
  field: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Frontmatter field to sort by (e.g., date)' })
  ),

  /** Sort order */
  order: Schema.optional(
    Schema.Literal('asc', 'desc').pipe(
      Schema.annotations({ description: 'Sort order (default: desc)' })
    )
  ),

  /** Sort direction (alias for order) */
  direction: Schema.optional(
    Schema.Literal('asc', 'desc').pipe(
      Schema.annotations({ description: 'Sort direction (alias for order)' })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ContentDirSort',
    title: 'Content Directory Sort',
    description: 'Sort configuration for content directory collection pages',
  })
)

/**
 * Content directory collection configuration.
 *
 * Turns a page into a collection that generates one route per markdown file
 * in the specified directory. Similar to blog engines or documentation sites.
 *
 * @example
 * ```typescript
 * // Basic blog
 * contentDir: { directory: 'content/blog', slugFrom: 'filename' }
 *
 * // Documentation with filepath slugs
 * contentDir: { directory: 'content/docs', slugFrom: 'filepath' }
 *
 * // With glob filter and sort
 * contentDir: {
 *   directory: 'content/blog',
 *   slugFrom: 'filename',
 *   include: '*.md',
 *   sort: { field: 'date', order: 'desc' }
 * }
 * ```
 */
export const ContentDirSchema = Schema.Struct({
  /** Directory path containing markdown files */
  directory: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Directory containing markdown content files' })
  ),

  /** How to derive the URL slug from each file */
  slugFrom: Schema.Literal('filename', 'filepath').pipe(
    Schema.annotations({
      description: 'Derive URL slug from filename (blog-post.md → blog-post) or filepath',
    })
  ),

  /** Glob pattern to filter which files to include */
  include: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Glob pattern to filter files (e.g., *.md)' })
    )
  ),

  /** Sort configuration for the collection */
  sort: Schema.optional(ContentDirSortSchema),

  /** Filter configuration for the collection */
  filter: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }).pipe(
      Schema.annotations({
        description: 'Filter conditions for content files (e.g., by frontmatter)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ContentDir',
    title: 'Content Directory',
    description:
      'Collection configuration that generates one route per markdown file in a directory',
  })
)

/** @public */
export type ContentDir = Schema.Schema.Type<typeof ContentDirSchema>
