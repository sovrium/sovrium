/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { markdownToText } from '@/domain/services/markdown/markdown-to-text'
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

export interface RssFeedItem {
  readonly title: string
  readonly link: string
  readonly description: string
  readonly pubDate?: string
}

interface BuildRssFeedXmlInput {
  readonly app: App
  readonly page: Page
  readonly records: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly baseUrl: string
}

interface BuildRssFeedXmlFromItemsInput {
  readonly app: App
  readonly baseUrl: string
  readonly items: readonly RssFeedItem[]
}

export function buildRssFeedXmlFromItems(input: BuildRssFeedXmlFromItemsInput): string {
  const { app, baseUrl, items } = input

  const channelTitle = escapeXml(app.name)
  const channelDescription = escapeXml(app.description ?? 'Application built with Sovrium')
  const trimmedBase = baseUrl.replace(/\/$/, '')
  const channelLink = escapeXml(trimmedBase)
  const feedUrl = escapeXml(`${trimmedBase}/feed.xml`)
  const lastBuildDate = new Date().toUTCString()

  const itemsXml = items.map((item) => {
    const title = escapeXml(item.title)
    const description = escapeXml(item.description)
    const link = escapeXml(item.link)
    const pubDate = item.pubDate ?? lastBuildDate
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
${itemsXml.join('\n')}
  </channel>
</rss>`
}

export function buildRssFeedXml(input: BuildRssFeedXmlInput): string {
  const { app, page, records, baseUrl } = input
  const slugField = page.collection?.slugField ?? 'slug'
  const limit = resolveRssLimit(page.rss)
  const trimmedBase = baseUrl.replace(/\/$/, '')

  const items = records.slice(0, limit).map((record): RssFeedItem => {
    const pubDate = formatRfc822(record['published_at'])
    return {
      title: pickItemTitle(record, slugField),
      link: `${trimmedBase}${expandPagePath(page, record)}`,
      description: pickItemDescription(record),
      ...(pubDate !== undefined ? { pubDate } : {}),
    }
  })

  return buildRssFeedXmlFromItems({ app, baseUrl, items })
}

export interface MarkdownFeedSection {
  readonly heading: string
  readonly body: string
}

const LEVEL2_HEADING_RE = /^##[ \t]+(.+?)[ \t]*$/

interface SectionScanState {
  readonly sections: readonly { readonly heading: string; readonly lines: readonly string[] }[]
  readonly current: { readonly heading: string; readonly lines: readonly string[] } | undefined
}

export function parseMarkdownFeedSections(markdown: string): readonly MarkdownFeedSection[] {
  const lines = markdown.split(/\r?\n/)
  const finalState = lines.reduce<SectionScanState>(
    (state, line) => {
      const match = LEVEL2_HEADING_RE.exec(line)
      if (match !== null) {
        const heading = (match[1] ?? '').trim()
        const flushed =
          state.current !== undefined ? [...state.sections, state.current] : state.sections
        return { sections: flushed, current: { heading, lines: [] } }
      }
      if (state.current === undefined) return state
      return {
        sections: state.sections,
        current: { heading: state.current.heading, lines: [...state.current.lines, line] },
      }
    },
    { sections: [], current: undefined }
  )
  const all =
    finalState.current !== undefined
      ? [...finalState.sections, finalState.current]
      : finalState.sections
  return all.map((section) => ({ heading: section.heading, body: section.lines.join('\n').trim() }))
}

function extractHeadingDatePhrase(heading: string): string | undefined {
  const emDashIdx = heading.lastIndexOf('—')
  if (emDashIdx >= 0) {
    const phrase = heading.slice(emDashIdx + 1).trim()
    return phrase.length > 0 ? phrase : undefined
  }
  const hyphenMatch = / - ([^-]+)$/.exec(heading)
  if (hyphenMatch !== null) {
    const phrase = (hyphenMatch[1] ?? '').trim()
    return phrase.length > 0 ? phrase : undefined
  }
  return undefined
}

interface BuildMarkdownRssItemsInput {
  readonly sections: readonly MarkdownFeedSection[]
  readonly page: Page
  readonly baseUrl: string
  readonly limit: number
  readonly slugify: (heading: string) => string
}

export function buildMarkdownRssItems(input: BuildMarkdownRssItemsInput): readonly RssFeedItem[] {
  const { sections, page, baseUrl, limit, slugify } = input
  const trimmedBase = baseUrl.replace(/\/$/, '')
  return sections.slice(0, limit).map((section): RssFeedItem => {
    const slug = slugify(section.heading)
    const plainBody = markdownToText(section.body)
    const description = plainBody.length > 280 ? `${plainBody.slice(0, 280)}...` : plainBody
    const pubDate = formatRfc822(extractHeadingDatePhrase(section.heading))
    return {
      title: section.heading,
      link: `${trimmedBase}${page.path}#${slug}`,
      description,
      ...(pubDate !== undefined ? { pubDate } : {}),
    }
  })
}

export function findRssPage(app: App): Page | undefined {
  if (!app.pages) return undefined
  return app.pages.find((page) => page.rss !== undefined && page.rss !== false)
}
