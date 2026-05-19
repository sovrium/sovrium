/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const SitemapChangefreqSchema = Schema.Literal(
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never'
).annotations({
  title: 'Sitemap Change Frequency',
  description: 'Hint to search engines about how often the page content changes',
})


export const SitemapConfigSchema = Schema.Union(
  Schema.Literal(false).annotations({
    description: 'Set to false to exclude this page from the sitemap',
  }),
  Schema.Struct({
    priority: Schema.optional(
      Schema.Number.pipe(
        Schema.greaterThanOrEqualTo(0),
        Schema.lessThanOrEqualTo(1),
        Schema.annotations({
          description: 'Sitemap priority (0.0 to 1.0, default: 0.5)',
          examples: [0.5, 0.8, 1.0],
        })
      )
    ),
    changefreq: Schema.optional(SitemapChangefreqSchema),
  }).annotations({
    description: 'Sitemap entry configuration with priority and change frequency',
  })
).annotations({
  identifier: 'SitemapConfig',
  title: 'Sitemap Configuration',
  description: 'Per-page sitemap configuration, or false to exclude from sitemap',
})


export type SitemapChangefreq = Schema.Schema.Type<typeof SitemapChangefreqSchema>
export type SitemapConfig = Schema.Schema.Type<typeof SitemapConfigSchema>
