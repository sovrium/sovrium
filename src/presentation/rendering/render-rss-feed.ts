/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  buildRssFeedXml,
  findRssPage,
  resolveRssLimit,
} from '@/domain/services/feeds/rss-feed-builder'
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

export async function renderRssFeed(
  app: App,
  baseUrl: string,
  db: DataSourceDb
): Promise<string | undefined> {
  const page = findRssPage(app)
  if (page === undefined) return undefined

  const { collection } = page
  if (collection === undefined) {
    return undefined
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
