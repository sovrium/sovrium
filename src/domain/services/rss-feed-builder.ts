/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure RSS 2.0 feed XML builder (US-PAGES-ACCESS-PUBLISHING-004).
 *
 * Lives in `domain/services` because it is a pure transformation —
 * `(app, page, records, baseUrl) => xml` — with no side effects, mirroring
 * the sitemap generator's role in `static-content-generators.ts`. The
 * caller (the page-renderer adapter) supplies the records array; this
 * function does NOT touch the database.
 *
 * Channel-level fields are sourced from the App schema (`name`,
 * `description`) because the page's `meta.title` / `meta.description`
 * carry per-record `$record.*` tokens that only make sense for HTML
 * pages. A reader subscribing to the feed needs a stable channel title,
 * not a templated one.
 *
 * Per-item fields follow the WordPress / Webflow / Ghost convention:
 *   - <title>           — record `title` field
 *   - <link>            — `${baseUrl}${page.path with :slug → record[slugField]}`
 *   - <description>     — record `excerpt` (preferred) or `body` (fallback)
 *   - <pubDate>         — record `published_at` formatted as RFC 822, or
 *                         channel build date when absent
 *   - <guid isPermaLink="true"> — same as <link>
 */

import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** Default item count when `rss: true` is set without a custom limit. */
const DEFAULT_RSS_LIMIT = 20

/** Reasonable cap to keep generated feeds bounded. */
const MAX_RSS_LIMIT = 200

/**
 * Resolve the per-feed item count limit.
 *
 * - `rss: true`              → default 20
 * - `rss: { limit: N }`      → N (capped at MAX_RSS_LIMIT)
 * - `rss: { }` (no limit)    → default 20
 * - falsy / undefined        → caller-defended; this helper assumes it's already filtered
 */
export function resolveRssLimit(rss: Page['rss']): number {
  if (rss === undefined || rss === false) return DEFAULT_RSS_LIMIT
  if (rss === true) return DEFAULT_RSS_LIMIT
  const { limit } = rss
  if (limit === undefined) return DEFAULT_RSS_LIMIT
  return Math.min(limit, MAX_RSS_LIMIT)
}

/**
 * Escape the five XML predefined entities so a free-text record value
 * (title, excerpt, etc.) cannot break the surrounding XML structure.
 * Mirrors the behaviour of the sitemap generator which currently escapes
 * nothing — RSS is more user-facing than sitemap, so we are stricter.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format a JavaScript Date (or ISO 8601 string) as RFC 822 — the canonical
 * `<pubDate>` format expected by RSS 2.0 readers. Returns `undefined` when
 * the value isn't a parseable date so the caller can fall back to the
 * channel build date.
 */
export function formatRfc822(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return undefined
  return date.toUTCString()
}

/**
 * Substitute `:paramName` segments in a page path with values from the
 * record. Used to build the per-item canonical URL — eg. `/blog/:slug`
 * with `record.slug = 'hello-world'` yields `/blog/hello-world`.
 *
 * The slug field is taken from `page.collection.slugField`; any other
 * `:param` in the path falls back to the empty string (in practice
 * collection pages have a single dynamic segment).
 */
function expandPagePath(page: Page, record: Readonly<Record<string, unknown>>): string {
  return page.path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, paramName: string) => {
    const value = record[paramName]
    return value === undefined || value === null ? '' : String(value)
  })
}

/**
 * Resolve a record's "description" — `excerpt` is preferred (matches the
 * Webflow / Ghost convention of a hand-crafted summary); we fall back to
 * `body` truncated to a reasonable length, then to the empty string.
 */
function pickItemDescription(record: Readonly<Record<string, unknown>>): string {
  const { excerpt, body } = record
  if (typeof excerpt === 'string' && excerpt.length > 0) return excerpt
  if (typeof body === 'string' && body.length > 0) {
    return body.length > 280 ? `${body.slice(0, 280)}...` : body
  }
  return ''
}

/** Resolve the record's title field — falls back to the slug for diagnostics. */
function pickItemTitle(record: Readonly<Record<string, unknown>>, slugField: string): string {
  const { title } = record
  if (typeof title === 'string' && title.length > 0) return title
  const slug = record[slugField]
  return typeof slug === 'string' ? slug : ''
}

interface BuildRssFeedXmlInput {
  readonly app: App
  readonly page: Page
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly baseUrl: string
}

/**
 * Build a complete RSS 2.0 document for a collection page.
 *
 * The caller is expected to:
 *   1. Have already validated the page has `rss !== false && rss !== undefined`.
 *   2. Have already applied `collection.filter` and the rss limit when
 *      fetching `records` from the database (so the slice here is purely
 *      defensive against caller bugs — the real cap lives in the fetcher).
 *
 * Per APP-PAGES-PUBLISHING-014..018 the channel includes title, link,
 * description, lastBuildDate, and an atom:link self-reference. Each item
 * carries title / link / description / pubDate / guid.
 */
export function buildRssFeedXml(input: BuildRssFeedXmlInput): string {
  const { app, page, records, baseUrl } = input
  const slugField = page.collection?.slugField ?? 'slug'
  const limit = resolveRssLimit(page.rss)
  const limitedRecords = records.slice(0, limit)

  const channelTitle = escapeXml(app.name)
  const channelDescription = escapeXml(app.description ?? 'Application built with Sovrium')
  const trimmedBase = baseUrl.replace(/\/$/, '')
  const channelLink = escapeXml(trimmedBase)
  const feedUrl = escapeXml(`${trimmedBase}/feed.xml`)
  const lastBuildDate = new Date().toUTCString()

  const items = limitedRecords.map((record) => {
    const title = escapeXml(pickItemTitle(record, slugField))
    const description = escapeXml(pickItemDescription(record))
    const link = escapeXml(`${trimmedBase}${expandPagePath(page, record)}`)
    const pubDate = formatRfc822(record['published_at']) ?? lastBuildDate
    return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${link}</guid>
    </item>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${channelTitle}</title>
    <link>${channelLink}</link>
    <description>${channelDescription}</description>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items.join('\n')}
  </channel>
</rss>`
}

/**
 * Locate the first page in `app.pages` with a non-falsy `rss` declaration.
 * Returns `undefined` when no page opts in to feed generation — the route
 * handler then 404s `/feed.xml`.
 *
 * "First match wins" mirrors the sitemap behaviour: a single feed per
 * application keeps the URL stable (`/feed.xml`) and matches reader
 * conventions. Multi-feed support (one per collection) is a future
 * enhancement; the schema is forward-compatible because `rss` is
 * declared per-page.
 */
export function findRssPage(app: App): Page | undefined {
  if (!app.pages) return undefined
  return app.pages.find((page) => page.rss !== undefined && page.rss !== false)
}
