/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The address a page's feed is served at: an absolute path with no route
 * parameter, no wildcard, no query and no trailing slash, such as
 * `/journal/feed.xml`.
 */
const FEED_PATH_PATTERN = /^(?:\/[A-Za-z0-9._~-]+)+$/

/**
 * Per-page RSS feed configuration.
 *
 * - `true`: publish the page's feed with the default settings (20 items)
 * - `{ limit }`: publish it with a custom item count
 * - `{ title, description }`: name the feed itself, when the page's own
 *   title names one record
 * - `{ path }`: serve the feed at an address of its own, so a second page can
 *   publish a feed beside the first one's `/feed.xml`
 *
 * @example
 * ```yaml
 * rss: true
 * rss: { limit: 25 }
 * rss: { path: /journal/feed.xml, title: Journal }
 * ```
 */
export const PageRssSchema = Schema.Union([
  Schema.Boolean.annotate({
    description: 'Enable RSS feed with default settings (20 items)',
  }),
  Schema.Struct({
    /** Maximum number of items in the RSS feed */
    limit: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          description: 'Maximum number of items in the RSS feed',
          examples: [10, 20, 50],
        }),
        Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
      )
    ),
    /** The feed's own name, for a page whose title names one record */
    title: Schema.optional(
      Schema.String.annotate({
        description:
          "The feed's name as a feed reader lists it. Takes precedence over the page's `meta.title`, and is the way to name the feed of a collection page whose title names one record. Accepts a `$t:` key.",
        examples: ['Field Notes', '$t:feed.title'],
      })
    ),
    /** The feed's own description */
    description: Schema.optional(
      Schema.String.annotate({
        description:
          "One line a feed reader shows under the feed's name. Takes precedence over the page's `meta.description`. Accepts a `$t:` key.",
        examples: ['Essays on building and running software a small team owns.'],
      })
    ),
    /** The address the feed is served at */
    path: Schema.optional(
      Schema.String.annotate({
        description:
          "The address this page's feed is served at, an absolute path with no route parameter and no trailing slash. A page that names none publishes at `/feed.xml`, so an app with one feed needs no `path`; give each further feed its own, such as `/journal/feed.xml`. The page announces its feed at this address in its head. A `path` another feed already uses, `/feed.xml` included, is refused, naming both pages.",
        examples: ['/journal/feed.xml', '/changelog/feed.xml'],
        defaultNote: '/feed.xml',
        howTo:
          'Give a second feed its own address: `rss: { path: /journal/feed.xml, title: Journal }`.',
      }).pipe(
        Schema.check(
          Schema.isPattern(FEED_PATH_PATTERN, {
            message:
              'rss.path must be an absolute path such as /journal/feed.xml, with no route parameter, wildcard, query or trailing slash',
          })
        )
      )
    ),
  }),
]).annotate({
  identifier: 'PageRss',
  title: 'RSS Feed Configuration',
  description: 'RSS feed generation for collection pages',
})

export type PageRss = Schema.Schema.Type<typeof PageRssSchema>
