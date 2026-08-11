/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RSS feed renderer.
 *
 * Mirrors the `render-page.tsx` orchestration layer for `/feed.xml`:
 *   1. Find the first page in `app.pages` that opts in via `page.rss`.
 *   2. Pull the published collection records from the database, applying
 *      `collection.filter` and the rss limit.
 *   3. Hand off to the pure `buildRssFeedXml` builder.
 *
 * Returns `undefined` when no page opts in — the route handler 404s. The
 * fetch step uses the same `DataSourceDb` adapter as `render-page.tsx` so
 * the same SQL primitives back both code paths (B-1 / B-2).
 *
 * Sort convention: descending `published_at` matches the Webflow / Ghost
 * default. When the table doesn't have a `published_at` field the SQL
 * column simply doesn't exist — `data-source-resolver-live` would error.
 * To stay defensive we sort by `published_at` only when the rss page's
 * collection table declares the field; otherwise we fall back to the
 * primary key (insert order). The convention is [internal ref] —
 * tables that participate in publishing already declare `published_at`,
 * but rss-only tables (eg. release notes) shouldn't crash the feed.
 */

import { isAbsolute, resolve } from 'node:path'
import {
  buildMarkdownRssItems,
  buildRssFeedXml,
  buildRssFeedXmlFromItems,
  findRssPage,
  parseMarkdownFeedSections,
  resolveRssChannelIdentity,
  resolveRssLimit,
} from '@/domain/services/feeds/rss-feed-builder'
import { slugify } from '@/infrastructure/markdown/markdown-it-renderer'
import { getContentBaseDir } from '@/presentation/rendering/content-base-dir'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'

/**
 * Resolve the sort column for the rss feed.
 *
 * Convention-driven: `published_at` desc when the rss page's collection
 * table declares such a field; otherwise `id` desc (newest insert first).
 * The fall-back keeps rss working for tables that haven't adopted the
 * publishing convention, avoiding a hard schema requirement on rss.
 */
function resolveRssSort(app: App, page: Page): readonly DataSort[] {
  const tableName = page.collection?.table
  if (tableName === undefined) return [{ field: 'id', direction: 'desc' }]
  const table = app.tables?.find((t) => t.name === tableName)
  const hasPublishedAt = table?.fields?.some((f) => f.name === 'published_at')
  return hasPublishedAt
    ? [{ field: 'published_at', direction: 'desc' }]
    : [{ field: 'id', direction: 'desc' }]
}

/**
 * Read a markdown source from disk under the content base dir.
 *
 * Mirrors `markdown-page-resolver.readMarkdownFile`: relative paths anchor at
 * `getContentBaseDir()` (the `SOVRIUM_CONTENT_DIR` override, else `cwd`), the
 * same way the page renderer resolves `markdown.file`. Returns `undefined` on
 * any I/O failure so a missing changelog file 404s the feed rather than 500ing.
 */
async function readMarkdownFeedSource(path: string): Promise<string | undefined> {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(getContentBaseDir(), path)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    return await file.text()
  } catch {
    return undefined
  }
}

/**
 * Render the RSS feed for a single `markdown: { file }` page (no DB collection)
 * — the changelog convention where each `## ` heading is one feed entry
 *. Returns `undefined` (→ 404) when the page has no
 * `markdown.file`, the file is missing/unreadable, or it has zero `## ` sections.
 */
async function renderMarkdownRssFeed(
  app: App,
  page: Page,
  baseUrl: string
): Promise<string | undefined> {
  const file = page.markdown?.file
  if (typeof file !== 'string' || file.length === 0) return undefined

  const source = await readMarkdownFeedSource(file)
  if (source === undefined) return undefined

  const sections = parseMarkdownFeedSections(source)
  if (sections.length === 0) return undefined

  const limit = resolveRssLimit(page.rss)
  const items = buildMarkdownRssItems({ sections, page, baseUrl, limit, slugify })
  const { title: channelTitle, description: channelDescription } = resolveRssChannelIdentity(
    app,
    page
  )
  return buildRssFeedXmlFromItems({ app, baseUrl, items, channelTitle, channelDescription })
}

/**
 * Render the RSS XML feed for the first opted-in collection page.
 *
 * `baseUrl` is the absolute origin of the request (eg.
 * `http://localhost:3000`). The route handler derives it from
 * `c.req.url` so a deployed app's feed advertises its real host.
 */
export async function renderRssFeed(
  app: App,
  baseUrl: string,
  db: DataSourceDb
): Promise<string | undefined> {
  const page = findRssPage(app)
  if (page === undefined) return undefined

  const { collection } = page
  if (collection === undefined) {
    // No DB collection: fall back to the single markdown-file source (a
    // changelog page opting into a feed via `markdown: { file }` + `rss`).
    // Still `undefined` (→ 404) when the page is neither a collection nor a
    // usable markdown source.
    return renderMarkdownRssFeed(app, page, baseUrl)
  }

  const limit = resolveRssLimit(page.rss)
  const sort = resolveRssSort(app, page)
  const filter = collection.filter as readonly DataFilter[] | undefined

  const records = await db.fetchRecords(collection.table, {
    ...(filter !== undefined ? { filter } : {}),
    sort,
    pageSize: limit,
    page: 1,
  })

  return buildRssFeedXml({
    app,
    page,
    records,
    baseUrl,
  })
}
