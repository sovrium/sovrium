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

const ContentDirNavSchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Enable a docs sidebar derived from the collection files' })
    )
  ),

  groupBy: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'Frontmatter field used to group sidebar entries (e.g., category)',
      })
    )
  ),

  labelFrom: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'Frontmatter field used as the sidebar link label (e.g., title)',
      })
    )
  ),

  groupLabels: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).pipe(
      Schema.annotations({
        description:
          'Map of raw groupBy keys to display labels (e.g., { Guides: "Developer Guides" })',
      })
    )
  ),

  groupIcons: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }).pipe(
      Schema.annotations({
        description:
          'Map of raw groupBy keys to Lucide icon names (kebab-case, e.g. { tables: "compass" })',
      })
    )
  ),

  collapsed: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Collapse sidebar group sections by default, expanding only the active group (default: false)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ContentDirNav',
    title: 'Content Directory Navigation',
    description: 'Sidebar navigation configuration derived from a content directory collection',
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

  nav: Schema.optional(ContentDirNavSchema),

  editUrl: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description:
          'Edit-this-page URL template for docs articles. Placeholders: {slug} (resolved article slug), {path} (source file path relative to directory, = {slug}.md), {lang} (active request language, empty when no /:lang/ prefix). Absent = no edit link (opt-in, default off). E.g. https://github.com/acme/repo/edit/main/docs/{lang}/{slug}.md',
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
