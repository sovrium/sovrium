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

import { Effect } from 'effect'
import { buildSignedOutReader } from '@/application/use-cases/automations/build-guest-session'
import { lookupReadMasks } from '@/application/use-cases/tables/lookup-read-masks'
import {
  SITEMAP_MAX_URLS,
  buildCollectionRecordPath,
  resolveSitemapCollectionSource,
  type SitemapCollectionSource,
} from '@/domain/models/app/pages/sitemap-builder'
import { signedOutRowAdmission } from '@/domain/models/app/tables/row-read-admission-service'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { LookupReadMask } from '@/application/ports/repositories/tables/table-repository'
import type { FetchSitemapRecords } from '@/application/ports/services/page-renderer'
import type { App, Page } from '@/domain/models/app'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'

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

/**
 * The masks of the lookups and counts a collection filter names, read as a
 * signed-out visitor's records list reads them (`lookupReadMasks`).
 */
export type SitemapReadMasks = (
  tableName: string,
  filter: readonly DataFilter[]
) => Promise<readonly LookupReadMask[]>

/**
 * What the record fan-out needs: the app to judge its tables, a row reader,
 * and the masks its filters steer by — absent, a filter reads stored values.
 */
export interface RecordFanOut {
  readonly app: App
  readonly fetchRecords: FetchSitemapRecords
  readonly readMasks?: SitemapReadMasks
}

/** A collection source whose filter is narrowed to the rows a visitor may list. */
type ListedSource = SitemapCollectionSource & {
  readonly filter: readonly DataFilter[]
  readonly lookupMasks: readonly LookupReadMask[]
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
  source: ListedSource,
  page: number
): Promise<readonly Readonly<Record<string, unknown>>[]> => {
  const fields = [source.slugField, ...(source.updatedAtField ? [source.updatedAtField] : [])]
  const rows = await records.fetchRecords(source.table, {
    fields,
    ...(source.filter.length > 0 ? { filter: source.filter } : {}),
    sort: [{ field: 'id', direction: 'asc' }],
    pageSize: SITEMAP_RECORD_PAGE_SIZE,
    page,
    liveOnly: true,
    ...(source.lookupMasks.length > 0 ? { lookupMasks: source.lookupMasks } : {}),
  })
  if (rows.length < SITEMAP_RECORD_PAGE_SIZE || page >= SITEMAP_MAX_RECORD_PAGES) return rows
  return [...rows, ...(await readRecordPages(records, source, page + 1))]
}

/**
 * One entry per record of a collection page whose table an anonymous crawler
 * could read, among the rows her records list admits her, at the record's
 * resolved slug, dated by its `updated-at` value.
 * `undefined` when the page is not such a collection page (or no reader is
 * wired), so the caller falls through to the other expansions.
 */
export const expandCollectionRecords = async (
  page: Page,
  records: RecordFanOut | undefined
): Promise<readonly RecordPath[] | undefined> => {
  if (records === undefined) return undefined
  const found = resolveSitemapCollectionSource(page, records.app)
  if (found === undefined) return undefined
  // A crawler is a visitor who is not signed in: only the rows the records list
  // admits her are listed, and a table admitting her none lists no record.
  const admission = signedOutRowAdmission(records.app, found.table)
  if (admission.kind === 'no-row') return []
  const granted =
    admission.kind === 'granted-rows'
      ? [{ field: 'id', operator: 'in' as const, value: [...admission.ids] }]
      : []
  // Her filter steers on each count and lookup it names as her records list does.
  const own = found.filter ?? []
  const lookupMasks =
    own.length > 0 && records.readMasks !== undefined
      ? await records.readMasks(found.table, own)
      : []
  const source = { ...found, filter: [...own, ...granted], lookupMasks }
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

/** The memo key of one collection filter's masks. */
const masksKey = (tableName: string, filter: readonly DataFilter[]): string =>
  JSON.stringify([tableName, filter])

/**
 * The masks every collection filter of `app` steers by for a signed-out
 * visitor, computed once by the records list's own program
 * (`lookupReadMasks`) — for a build, which reads its records outside any
 * request. A filter naming no withheld lookup or count reads none.
 */
export const signedOutSitemapMasks = (
  app: App
): Effect.Effect<SitemapReadMasks, never, DataSourceRepository | AuthRepository> => {
  const reader = buildSignedOutReader(app)
  const sources = (app.pages ?? []).flatMap((page) => {
    const found = resolveSitemapCollectionSource(page, app)
    return found?.filter === undefined || found.filter.length === 0
      ? []
      : [{ table: found.table, filter: found.filter }]
  })
  return Effect.forEach(sources, ({ table, filter }) =>
    lookupReadMasks(app, table, reader, { filter }).pipe(
      Effect.map((masks) => [masksKey(table, filter), masks] as const)
    )
  ).pipe(
    Effect.map((entries) => {
      const masks = new Map(entries)
      return (tableName: string, filter: readonly DataFilter[]) =>
        Promise.resolve(masks.get(masksKey(tableName, filter)) ?? [])
    }),
    Effect.withSpan('server.signed-out-sitemap-masks')
  )
}

/** What a sitemap reads records from: a build's one enumeration, or a live row reader. */
export interface RecordSources {
  readonly app?: App
  readonly fetchRecords?: FetchSitemapRecords
  readonly readMasks?: SitemapReadMasks
  readonly collectionRecords?: CollectionRecordIndex
}

/** How a sitemap reads a page's records: the build's enumeration when given, else live. */
export const recordResolverFor =
  (sources: RecordSources | undefined) =>
  (page: Page): Promise<readonly RecordPath[] | undefined> => {
    const index = sources?.collectionRecords
    if (index !== undefined) return Promise.resolve(index.get(page.path))
    const { app, fetchRecords, readMasks } = sources ?? {}
    if (app === undefined || fetchRecords === undefined) return Promise.resolve(undefined)
    const masks = readMasks === undefined ? {} : { readMasks }
    return expandCollectionRecords(page, { app, fetchRecords, ...masks })
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

/**
 * Enumerate the listed records of every collection page for a build: each
 * collection filter steering on the counts and lookups it names as a
 * signed-out visitor's records list does ({@link signedOutSitemapMasks}).
 */
export const enumerateSignedOutRecords = <E>(
  pages: readonly Page[],
  records: Omit<RecordFanOut, 'readMasks'>,
  onError: (error: unknown) => E
): Effect.Effect<CollectionRecordIndex, E, DataSourceRepository | AuthRepository> =>
  signedOutSitemapMasks(records.app).pipe(
    Effect.flatMap((readMasks) =>
      Effect.tryPromise({
        try: () => enumerateCollectionRecords(pages, { ...records, readMasks }),
        catch: onError,
      })
    ),
    Effect.withSpan('server.enumerate-signed-out-records')
  )
