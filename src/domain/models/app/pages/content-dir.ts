/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


const ContentDirSortSchema = Schema.Struct({
  field: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Frontmatter field to sort by (e.g., date)' })
  ),

  order: Schema.optional(
    Schema.Literal('asc', 'desc').pipe(
      Schema.annotations({ description: 'Sort order (default: desc)' })
    )
  ),

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

export const ContentDirSchema = Schema.Struct({
  directory: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Directory containing markdown content files' })
  ),

  slugFrom: Schema.Literal('filename', 'filepath').pipe(
    Schema.annotations({
      description: 'Derive URL slug from filename (blog-post.md → blog-post) or filepath',
    })
  ),

  include: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Glob pattern to filter files (e.g., *.md)' })
    )
  ),

  sort: Schema.optional(ContentDirSortSchema),

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

export type ContentDir = Schema.Schema.Type<typeof ContentDirSchema>
