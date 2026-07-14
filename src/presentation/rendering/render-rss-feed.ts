/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

function resolveRssSort(app: App, page: Page): readonly DataSort[] {
  const tableName = page.collection?.table
  if (tableName === undefined) return [{ field: 'id', direction: 'desc' }]
  const table = app.tables?.find((t) => t.name === tableName)
  const hasPublishedAt = table?.fields?.some((f) => f.name === 'published_at')
  return hasPublishedAt
    ? [{ field: 'published_at', direction: 'desc' }]
    : [{ field: 'id', direction: 'desc' }]
}

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

export async function renderRssFeed(
  app: App,
  baseUrl: string,
  db: DataSourceDb
): Promise<string | undefined> {
  const page = findRssPage(app)
  if (page === undefined) return undefined

  const { collection } = page
  if (collection === undefined) {
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
