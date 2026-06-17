/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

const DEFAULT_RSS_LIMIT = 20

const MAX_RSS_LIMIT = 200

export function resolveRssLimit(rss: Page['rss']): number {
  if (rss === undefined || rss === false) return DEFAULT_RSS_LIMIT
  if (rss === true) return DEFAULT_RSS_LIMIT
  const { limit } = rss
  if (limit === undefined) return DEFAULT_RSS_LIMIT
  return Math.min(limit, MAX_RSS_LIMIT)
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function formatRfc822(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const date = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(date.getTime())) return undefined
  return date.toUTCString()
}

function expandPagePath(page: Page, record: Readonly<Record<string, unknown>>): string {
  return page.path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, paramName: string) => {
    const value = record[paramName]
    return value === undefined || value === null ? '' : String(value)
  })
}

function pickItemDescription(record: Readonly<Record<string, unknown>>): string {
  const { excerpt, body } = record
  if (typeof excerpt === 'string' && excerpt.length > 0) return excerpt
  if (typeof body === 'string' && body.length > 0) {
    return body.length > 280 ? `${body.slice(0, 280)}...` : body
  }
  return ''
}

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

export function findRssPage(app: App): Page | undefined {
  if (!app.pages) return undefined
  return app.pages.find((page) => page.rss !== undefined && page.rss !== false)
}
