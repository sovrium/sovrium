/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure RSS 2.0 feed XML builder.
 *
 * Lives in `domain/services` because it is a pure transformation —
 * `(app, page, records, baseUrl) => xml` — with no side effects, mirroring
 * the sitemap generator's role in `static-content-generators.ts`. The
 * caller (the page-renderer adapter) supplies the records array; this
 * function does NOT touch the database.
 *
 * Channel-level fields prefer the rss page's `meta.title` / `meta.description`
 * (resolved via `resolveRssChannelIdentity`, with `$t:` resolved against
 * `app.languages.default`) so a public feed announces its own identity, and
 * fall back to the App schema (`name`, `description`) when the page has no meta
 * or the meta carries a per-record `$record.*` token — meaningless for a feed
 * shared across all readers, which needs a stable channel title.
 *
 * Per-item fields follow the WordPress / Webflow / Ghost convention:
 *   - <title>           — record `title` field
 *   - <link>            — `${baseUrl}${page.path with :slug → record[slugField]}`
 *   - <description>     — record `excerpt` (preferred) or `body` (fallback)
 *   - <pubDate>         — record `published_at` formatted as RFC 822, or
 *                         channel build date when absent
 *   - <guid isPermaLink="true"> — same as <link>
 */

import { markdownToText } from '@/domain/services/markdown/markdown-to-text'
import { resolveTranslationPattern } from '@/domain/utils/translation-resolver'
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

/**
 * A pre-built feed entry, source-agnostic. Both the DB-collection path and the
 * markdown-file path produce these, and `buildRssFeedXmlFromItems` wraps them in
 * the shared channel envelope. Values are RAW (unescaped) — the envelope builder
 * escapes them. `pubDate` is already RFC-822 formatted, or omitted so the
 * envelope falls back to the channel `lastBuildDate`.
 */
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
  /** Forwarded to {@link BuildRssFeedXmlFromItemsInput.now}. */
  readonly now?: Date
}

interface BuildRssFeedXmlFromItemsInput {
  readonly app: App
  readonly baseUrl: string
  readonly items: readonly RssFeedItem[]
  /**
   * Channel `<title>` override. When omitted the channel falls back to
   * `app.name` (backward-compatible). Callers with a page in hand resolve this
   * via {@link resolveRssChannelIdentity}.
   */
  readonly channelTitle?: string
  /**
   * Channel `<description>` override. When omitted the channel falls back to
   * `app.description ?? 'Application built with Sovrium'` (backward-compatible).
   */
  readonly channelDescription?: string
  /**
   * The clock, injected so the builder stays a pure function of its inputs.
   * The presentation caller passes the request time; the default exists only so
   * existing call sites and tests keep working.
   *
   * KNOWN LIMITATION, deliberately unchanged here: this value is ALSO the
   * per-item `pubDate` fallback, so an item supplying no `pubDate` gets one that
   * advances on every fetch while its `guid` stays fixed — which a reader may
   * present as a republished item. Choosing a stable fallback (the item's own
   * creation time, or omitting `pubDate` altogether) is a feed-semantics
   * decision, not a refactor.
   */
  readonly now?: Date
}

/**
 * Resolve the RSS `<channel>` title/description identity from the rss page's
 * `meta`, falling back to the app-level fields.
 *
 * A public feed should announce its OWN identity, so the rss page's `meta.title`
 * / `meta.description` drive the channel when present AND safe for a feed shared
 * across all readers. The page meta is IGNORED (falling back to `app.name` /
 * `app.description`) when:
 *   - the meta field is absent or empty, or
 *   - it carries a per-record `$record.*` token (meaningless for a shared feed —
 * the [internal ref] fallback guard).
 * `$t:` tokens resolve against `app.languages.default` (the feed is shared, so
 * the default locale wins regardless of any reader's locale —
 * [internal ref]).
 */
export function resolveRssChannelIdentity(
  app: App,
  page: Page
): { readonly title: string; readonly description: string } {
  return {
    title: resolveChannelField(app, page.meta?.title, app.name),
    description: resolveChannelField(
      app,
      page.meta?.description,
      app.description ?? 'Application built with Sovrium'
    ),
  }
}

/**
 * Resolve a single channel field from a page-meta value, falling back to
 * `fallback` when the meta is absent/empty or carries a per-record `$record.*`
 * token. A safe meta value has its `$t:` token resolved against the default
 * locale.
 */
function resolveChannelField(app: App, metaValue: unknown, fallback: string): string {
  if (typeof metaValue !== 'string' || metaValue.length === 0 || metaValue.includes('$record.')) {
    return fallback
  }
  return resolveTranslationPattern(metaValue, app.languages?.default ?? 'en', app.languages)
}

/**
 * Build a complete RSS 2.0 document from pre-built, source-agnostic items.
 *
 * This is the shared channel envelope both feed sources funnel through — the DB
 * collection path (`buildRssFeedXml`) and the single markdown-file path
 * (`buildMarkdownRssItems`). The channel `<title>`/`<description>` come from the
 * optional `channelTitle`/`channelDescription` overrides (resolved from the rss
 * page's `meta` via {@link resolveRssChannelIdentity}), falling back to the App
 * schema fields when omitted. Each item carries title / link / description /
 * pubDate / guid. Item fields are escaped here so callers only supply raw
 * strings.
 */
export function buildRssFeedXmlFromItems(input: BuildRssFeedXmlFromItemsInput): string {
  const { app, baseUrl, items } = input

  const channelTitle = escapeXml(input.channelTitle ?? app.name)
  const channelDescription = escapeXml(
    input.channelDescription ?? app.description ?? 'Application built with Sovrium'
  )
  const trimmedBase = baseUrl.replace(/\/$/, '')
  const channelLink = escapeXml(trimmedBase)
  const feedUrl = escapeXml(`${trimmedBase}/feed.xml`)
  const lastBuildDate = (input.now ?? new Date()).toUTCString()

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

/**
 * Build a complete RSS 2.0 document for a collection page.
 *
 * The caller is expected to:
 *   1. Have already validated the page has `rss !== false && rss !== undefined`.
 *   2. Have already applied `collection.filter` and the rss limit when
 *      fetching `records` from the database (so the slice here is purely
 *      defensive against caller bugs — the real cap lives in the fetcher).
 *
 *..018 the channel includes title, link,
 * description, lastBuildDate, and an atom:link self-reference. Each item
 * carries title / link / description / pubDate / guid.
 */
export function buildRssFeedXml(input: BuildRssFeedXmlInput): string {
  const { app, page, records, baseUrl, now } = input
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

  const { title: channelTitle, description: channelDescription } = resolveRssChannelIdentity(
    app,
    page
  )
  return buildRssFeedXmlFromItems({ app, baseUrl, items, channelTitle, channelDescription, now })
}

/** A level-2 (`## `) section extracted from a markdown changelog source. */
export interface MarkdownFeedSection {
  /** Heading text verbatim (the text after `## `). */
  readonly heading: string
  /** Raw markdown between this heading and the next `## ` (or EOF), trimmed. */
  readonly body: string
}

/** Matches a level-2 ATX heading line (`## text`), never `### text`. */
const LEVEL2_HEADING_RE = /^##[ \t]+(.+?)[ \t]*$/

interface SectionScanState {
  readonly sections: readonly { readonly heading: string; readonly lines: readonly string[] }[]
  readonly current: { readonly heading: string; readonly lines: readonly string[] } | undefined
}

/**
 * Split a markdown source into its level-2 (`## `) sections — the changelog
 * convention where each `## vX.Y.Z — date` block is one release entry. Content
 * BEFORE the first `## ` heading (the document title + intro) is ignored. Each
 * section's `body` is the raw markdown between its heading and the next `## `
 * (or EOF). Returns `[]` when the source has zero level-2 headings.
 *
 * Pure: a `reduce` over source lines, no I/O. Deeper headings (`### `) stay part
 * of their parent section's body.
 */
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

/**
 * Extract the trailing date phrase from a changelog heading — the text after the
 * last em dash (`—`) or spaced hyphen (` - `) separator, e.g.
 * `v2.0.0 — 5 June 2026` → `5 June 2026`. Prefers the em dash so a hyphenated
 * version tag (`v2.0.0-beta — …`) is not mis-split. Returns `undefined` when no
 * separator is present; the caller then falls back to the channel build date.
 */
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
  /**
   * Anchor slugifier — inject the SAME `slugify` the on-page `<h2 id="...">`
   * anchor uses (`@/infrastructure/markdown/markdown-it-renderer`) so the feed's
   * `#fragment` deep-links to the exact rendered release section.
   */
  readonly slugify: (heading: string) => string
}

/**
 * Build one `RssFeedItem` per level-2 section for a single `markdown: { file }`
 * page (no DB collection). Each item:
 *   - `title`       — the heading text verbatim.
 *   - `link`/`guid` — `${baseUrl}${page.path}#${slugify(heading)}` (deep-link to
 *     the on-page anchor).
 *   - `description` — the section body as plain text (`markdownToText`), capped
 *     at 280 chars (mirrors `pickItemDescription`).
 *   - `pubDate`     — RFC-822 from the heading's trailing date phrase, or omitted
 *     (envelope falls back to the channel build date) when unparseable.
 *
 * Sections are consumed in document order (changelog convention: newest first)
 * and capped at `limit`. Pure: takes `slugify` as an injected dependency.
 */
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
