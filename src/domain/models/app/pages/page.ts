/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { PageAccessSchema } from './access'
import { PageComponentsSchema } from './components'
import { DataFilterSchema } from './components/data-source'
import { SystemDetailSourceSchema } from './components/system-detail-source'
import { ContentDirSchema } from './content-dir'
import { DataSourceSchema } from './data-source'
import { PageIdSchema } from './id'
import { PageLayoutSchema } from './layout'
import { MarkdownSchema } from './markdown'
import { MetaSchema } from './meta'
import { PageNameSchema } from './name'
import { PagePathSchema } from './path'
import { ScriptsSchema } from './scripts'
import { SitemapConfigSchema } from './sitemap'
import { PageSourceSchema } from './source'
import { PageToastConfigSchema } from './toasts'
import { PageVarsSchema } from './vars'
import { ViewTransitionSchema } from './view-transition'

export const PageSchema = Schema.Struct({
  id: Schema.optional(PageIdSchema),

  name: PageNameSchema,

  path: PagePathSchema,

  meta: Schema.optional(MetaSchema),

  components: PageComponentsSchema,

  access: Schema.optional(PageAccessSchema),

  toasts: Schema.optional(PageToastConfigSchema),

  scripts: Schema.optional(ScriptsSchema),

  vars: Schema.optional(PageVarsSchema),

  collection: Schema.optional(
    Schema.Struct({
      table: Schema.String.annotations({
        description: 'Table name to generate collection pages from',
      }),
      slugField: Schema.String.annotations({
        description: 'Field used as the URL slug parameter',
      }),
      filter: Schema.optional(
        Schema.Array(DataFilterSchema).annotations({
          description: 'Filter conditions to limit which records generate pages',
        })
      ),
    }).annotations({
      identifier: 'PageCollection',
      title: 'Page Collection',
      description: 'Template page configuration that generates one route per table record',
    })
  ),

  sitemap: Schema.optional(SitemapConfigSchema),

  rss: Schema.optional(
    Schema.Union(
      Schema.Boolean.annotations({
        description: 'Enable RSS feed with default settings (20 items)',
      }),
      Schema.Struct({
        limit: Schema.optional(
          Schema.Number.pipe(
            Schema.int(),
            Schema.greaterThan(0),
            Schema.annotations({
              description: 'Maximum number of items in the RSS feed',
              examples: [10, 20, 50],
            })
          )
        ),
      })
    ).annotations({
      identifier: 'PageRss',
      title: 'RSS Feed Configuration',
      description: 'RSS feed generation for collection pages',
    })
  ),

  layout: Schema.optional(PageLayoutSchema),

  viewTransition: Schema.optional(ViewTransitionSchema),

  markdown: Schema.optional(MarkdownSchema),

  contentDir: Schema.optional(ContentDirSchema),

  source: Schema.optional(PageSourceSchema),

  presence: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Enable real-time presence awareness for this page',
      })
    )
  ),

  dataSource: Schema.optional(
    Schema.Union(
      DataSourceSchema,
      Schema.Struct({
        system: SystemDetailSourceSchema,
      }).annotations({
        title: 'Page System Detail Source',
        description: 'System detail-endpoint binding for a page-level single-record context',
      })
    ).annotations({
      identifier: 'PageDataSourceBinding',
      title: 'Page Data Source',
      description:
        'DB-table single-record binding (DataSource) OR a system detail-endpoint binding',
    })
  ),

  allowedTables: Schema.optional(
    Schema.Array(Schema.String.pipe(Schema.minLength(1))).pipe(
      Schema.annotations({
        description: 'Tables accessible from this page context (e.g., for AI chat scoping)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Page',
    title: 'Page',
    description:
      'Complete page configuration with metadata, layout, components, and scripts. Pages use a component-based layout system with reusable component templates.',
  })
)

export type Page = typeof PageSchema.Type

export type PageEncoded = typeof PageSchema.Encoded
