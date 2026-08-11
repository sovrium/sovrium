/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Sitemap Change Frequency
// ---------------------------------------------------------------------------

/**
 * Sitemap change frequency hint for search engines.
 */
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

// ---------------------------------------------------------------------------
// Sitemap Config
// ---------------------------------------------------------------------------

/**
 * Per-page sitemap configuration.
 *
 * Controls the page's entry in `/sitemap.xml`.
 * Set to `false` to exclude the page from the sitemap entirely.
 *
 * @example
 * ```yaml
 * # High-priority page
 * sitemap:
 *   priority: 1.0
 *   changefreq: weekly
 *
 * # Exclude from sitemap
 * sitemap: false
 * ```
 */
export const SitemapConfigSchema = Schema.Union(
  Schema.Literal(false).annotations({
    description: 'Set to false to exclude this page from the sitemap',
  }),
  Schema.Struct({
    /** Priority hint for search engines (0.0 to 1.0) */
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
    /** Change frequency hint */
    changefreq: Schema.optional(SitemapChangefreqSchema),
  }).annotations({
    description: 'Sitemap entry configuration with priority and change frequency',
  })
).annotations({
  identifier: 'SitemapConfig',
  title: 'Sitemap Configuration',
  description: 'Per-page sitemap configuration, or false to exclude from sitemap',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public */
export type SitemapChangefreq = Schema.Schema.Type<typeof SitemapChangefreqSchema>
/** @public */
export type SitemapConfig = Schema.Schema.Type<typeof SitemapConfigSchema>
