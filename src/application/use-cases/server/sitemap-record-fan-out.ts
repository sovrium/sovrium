/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record half of the sitemap: one entry per live, anonymously readable
 * record of a collection page, read in bounded pages.
 */

import {
  SITEMAP_MAX_URLS,
  buildCollectionRecordPath,
  resolveSitemapCollectionSource,
  type SitemapCollectionSource,
} from '@/domain/models/app/pages/sitemap-builder'
import type { FetchSitemapRecords } from '@/application/ports/services/page-renderer'
import type { App, Page } from '@/domain/models/app'

/** A concrete URL path plus its `<lastmod>`, when one is actually known. */
export interface RecordPath {
  readonly path: string
  readonly lastmod: string | undefined
}

/**
 * ISO 8601 with time, to the second (`2026-03-14T09:26:53Z`), or `undefined`
 * when the value is absent or not a date. Accepts a `Date` or a stored
 * timestamp string (a record's `updated-at` value arrives as either).
 */
export const toSitemapLastmod = (
  value: Readonly<Date> | string | undefined
): string | undefined => {
  if (value === undefined || value === '') return undefined
  const date = typeof value === 'string' ? new Date(value) : new Date(value.getTime())
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** What the record fan-out needs: the app to judge its tables, and a row reader. */
export interface RecordFanOut {
  readonly app: App
  readonly fetchRecords: FetchSitemapRecords
}

/**
 * Rows read per query: one child sitemap's worth plus one, so no single read
 * is larger than what one child can hold (plus the row that proves another
 * child is needed).
 */
const SITEMAP_RECORD_PAGE_SIZE = SITEMAP_MAX_URLS + 1

/**
 * Most record pages read for one collection — 10 pages of 5 001 rows. A table
 * past that lists its first 50 010 records; a sitemap is a crawl hint, not an
 * index of every row, and an unbounded read on an anonymous request is a
 * denial-of-service lever.
 */
const SITEMAP_MAX_RECORD_PAGES = 10

/** Read a collection's rows page by page until a short page or the page ceiling. */
const readRecordPages = async (
  records: RecordFanOut,
  source: SitemapCollectionSource,
  page: number
): Promise<readonly Readonly<Record<string, unknown>>[]> => {
  const fields = [source.slugField, ...(source.updatedAtField ? [source.updatedAtField] : [])]
  const rows = await records.fetchRecords(source.table, {
    fields,
    ...(source.filter !== undefined ? { filter: source.filter } : {}),
    sort: [{ field: 'id', direction: 'asc' }],
    pageSize: SITEMAP_RECORD_PAGE_SIZE,
    page,
    liveOnly: true,
  })
  if (rows.length < SITEMAP_RECORD_PAGE_SIZE || page >= SITEMAP_MAX_RECORD_PAGES) return rows
  return [...rows, ...(await readRecordPages(records, source, page + 1))]
}

/**
 * One entry per record of a collection page whose table an anonymous crawler
 * could read, at the record's resolved slug, dated by its `updated-at` value.
 * `undefined` when the page is not such a collection page (or no reader is
 * wired), so the caller falls through to the other expansions.
 */
export const expandCollectionRecords = async (
  page: Page,
  records: RecordFanOut | undefined
): Promise<readonly RecordPath[] | undefined> => {
  if (records === undefined) return undefined
  const source = resolveSitemapCollectionSource(page, records.app)
  if (source === undefined) return undefined
  const rows = await readRecordPages(records, source, 1)
  return rows.flatMap((row) => {
    const slug = row[source.slugField]
    const path =
      typeof slug === 'string' || typeof slug === 'number'
        ? buildCollectionRecordPath(page.path, String(slug))
        : undefined
    if (path === undefined) return []
    const updatedAt = source.updatedAtField ? row[source.updatedAtField] : undefined
    return [{ path, lastmod: toSitemapLastmod(toDateInput(updatedAt)) }]
  })
}

/** Narrow a stored timestamp (a `Date` or a string) to what `toSitemapLastmod` reads. */
const toDateInput = (value: unknown): Readonly<Date> | string | undefined =>
  value instanceof Date || typeof value === 'string' ? value : undefined

/**
 * The record addresses of every listed collection page, keyed by the page's
 * route template (`/blog/:slug`). A page absent from the map lists no record.
 */
export type CollectionRecordIndex = ReadonlyMap<string, readonly RecordPath[]>

/**
 * Enumerate the listed records of every collection page ONCE.
 *
 * A static build reads this a single time and hands the same result to both of
 * its consumers: the sitemap it writes and the record pages it renders. Two
 * reads could disagree — a row written between them would be listed without a
 * page, or paged without being listed — so the build never reads twice. The
 * pages are read one after another, so the build never holds more than one
 * paged query open at a time.
 */
export const enumerateCollectionRecords = async (
  pages: readonly Page[],
  records: RecordFanOut
): Promise<CollectionRecordIndex> => {
  const entries = await pages.reduce<
    Promise<readonly (readonly [string, readonly RecordPath[]])[]>
  >(async (previous, page) => {
    const collected = await previous
    const paths = await expandCollectionRecords(page, records)
    return paths === undefined ? collected : [...collected, [page.path, paths] as const]
  }, Promise.resolve([]))
  return new Map(entries)
}
