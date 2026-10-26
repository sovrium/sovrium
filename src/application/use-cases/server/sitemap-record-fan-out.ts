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
  pageRoutePatterns,
  primaryPagePath,
  type PageAddress,
} from '@/domain/kernel/matching/localized-path'
import {
  isTranslatableSlugField,
  recordLanguageAddresses,
} from '@/domain/models/app/pages/collection-slug-field-service'
import {
  SITEMAP_MAX_URLS,
  buildCollectionRecordPath,
  resolveSitemapCollectionSource,
  type SitemapCollectionSource,
} from '@/domain/models/app/pages/sitemap-builder'
import {
  isPredicateGroup,
  signedOutContext,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import { signedOutRowAdmission } from '@/domain/models/app/tables/row-read-admission-service'
import { visitorRowRule } from '@/domain/models/app/tables/visitor-row-rule-service'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { LookupReadMask } from '@/application/ports/repositories/tables/table-repository'
import type { FetchSitemapRecords } from '@/application/ports/services/page-renderer'
import type { App, Page } from '@/domain/models/app'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { RowLevelWhen } from '@/domain/models/app/tables/permissions'

/** A concrete URL path plus its `<lastmod>`, when one is actually known. */
export interface RecordPath {
  readonly path: string
  readonly lastmod: string | undefined
  /**
   * The record's address in each language it has a slug in, for a slug field
   * per language: the entry's `hreflang` pairs, the same the page's HTML names.
   */
  readonly alternates?: ReadonlyArray<PageAddress>
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
  /** The columns the table's row-level read rule reads, fetched beside the address. */
  readonly ruleFields: readonly string[]
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
  const fields = [
    ...new Set([
      ...(typeof source.slugField === 'string'
        ? [source.slugField]
        : Object.values(source.slugField)),
      ...(source.updatedAtField ? [source.updatedAtField] : []),
      ...source.ruleFields,
    ]),
  ]
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
  // Her row-level read rule, applied to each row as the records API applies it
  // to a signed-out visitor; a rule naming the signed-in person admits none.
  const rule = signedOutRowRule(records.app, found.table)
  if (rule === undefined) return []
  const source = { ...found, filter: [...own, ...granted], lookupMasks, ruleFields: rule.fields }
  const rows = rule.admitted(await readRecordPages(records, source, 1))
  if (hasSlugPerLanguage(records.app, source)) {
    return perLanguageRecordPaths(page, records.app, source, rows)
  }
  return sharedSlugRecordPaths(page, source, rows)
}

/** One entry per record per language its page is served in, at its one shared slug. */
const sharedSlugRecordPaths = (
  page: Page,
  source: SitemapCollectionSource,
  rows: readonly Row[]
): readonly RecordPath[] => {
  const { slugField } = source
  if (typeof slugField !== 'string') return []
  return rows.flatMap((row) => {
    const slug = row[slugField]
    if (typeof slug !== 'string' && typeof slug !== 'number') return []
    const updatedAt = source.updatedAtField ? row[source.updatedAtField] : undefined
    const lastmod = toSitemapLastmod(toDateInput(updatedAt))
    // One address per language a path-per-language page is served in.
    return pageRoutePatterns(page.path).flatMap((pattern) => {
      const path = buildCollectionRecordPath(pattern, String(slug))
      return path === undefined ? [] : [{ path, lastmod }]
    })
  })
}

/**
 * Whether a collection reads a slug per language — a field per language, or
 * ONE translatable field: it lists each record once per language it has a
 * slug in.
 */
const hasSlugPerLanguage = (app: App, source: SitemapCollectionSource): boolean =>
  typeof source.slugField !== 'string' ||
  isTranslatableSlugField(app.tables, source.table, source.slugField)

/**
 * One entry per record per language it has a slug in, each language's address
 * built from that language's field (or that language's value of one
 * translatable field, as stored) and paired with the record's others — the
 * pairs its page's HTML names (`recordLanguageAddresses`). A language whose
 * slug is empty lists no address.
 */
const perLanguageRecordPaths = (
  page: Page,
  app: App,
  source: SitemapCollectionSource,
  rows: readonly Row[]
): readonly RecordPath[] => {
  const languages = app.languages?.supported.map((language) => language.code) ?? []
  return rows.flatMap((row) => {
    const updatedAt = source.updatedAtField ? row[source.updatedAtField] : undefined
    const lastmod = toSitemapLastmod(toDateInput(updatedAt))
    const alternates =
      recordLanguageAddresses({
        path: page.path,
        slugField: source.slugField,
        record: row,
        languages,
        translatable: isTranslatableSlugField(app.tables, source.table, source.slugField),
      }) ?? []
    return alternates.map(({ path }) => ({ path, lastmod, alternates }))
  })
}

/** The declared table `name` of `app`. */
const tableOf = (app: App, name: string) => app.tables?.find((table) => table.name === name)

/**
 * The fields a table's row-level read rule compares, across every condition
 * of a group. A relationship chain or a `contains` lookup reads no column of
 * the row here: a signed-out visitor is admitted by no such leaf.
 */
const ruleFieldsOf = (app: App, tableName: string): readonly string[] => {
  const table = tableOf(app, tableName)
  const declared = new Set(table?.fields.map((field) => field.name) ?? [])
  const walk = (when: RowLevelWhen): readonly string[] =>
    isPredicateGroup(when)
      ? when.conditions.flatMap(walk)
      : declared.has(when.field)
        ? [when.field]
        : []
  const when = table?.rowLevelPermissions?.read?.when
  return when === undefined ? [] : walk(when)
}

type Row = Readonly<Record<string, unknown>>

/**
 * A table's row-level read rule for a signed-out crawler, judged as the records
 * API judges a signed-out visitor: the columns it reads, and the rows it admits
 * of those read. `undefined` when it admits no row at all.
 */
const signedOutRowRule = (
  app: App,
  tableName: string
):
  | {
      readonly fields: readonly string[]
      readonly admitted: (rows: readonly Row[]) => readonly Row[]
    }
  | undefined => {
  const rule = visitorRowRule(tableOf(app, tableName), undefined)
  if (rule.kind === 'none') return undefined
  if (rule.kind === 'all') return { fields: [], admitted: (rows) => rows }
  const reader = buildSignedOutReader(app)
  const context = signedOutContext(reader.session.userId, reader.role)
  return {
    fields: ruleFieldsOf(app, tableName),
    admitted: (rows) => rows.filter((row) => rule.admits(row, context)),
  }
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
    if (index !== undefined) return Promise.resolve(index.get(primaryPagePath(page.path)))
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
 * route template (`/blog/:slug`; a path per language by its `primaryPagePath`).
 * A page absent from the map lists no record.
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
    return paths === undefined
      ? collected
      : [...collected, [primaryPagePath(page.path), paths] as const]
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
