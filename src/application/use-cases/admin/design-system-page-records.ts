/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The addresses a routed page is drawn at by the page export: a single-record
 * page at its seeded records' ids, a `collection` page at the slugs of the
 * seeded records its filter keeps, a `contentDir` page at its first file's
 * slug; and why a routed page with no such address is skipped rather than
 * drawn at an address the app answers nothing at.
 */

import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import { queriedSeededRows } from '@/domain/models/app/pages/seeded-rows-service'
import { cappedSeedRows } from './design-system-page-seed'
import type { PageDrawOptions } from './design-system-page-boards'
import type { PageSeedRow } from './design-system-page-seed-folder'
import type { Page } from '@/domain/models/app/pages'

/** How many record boards a routed record page gets when `--records` says nothing. */
const DEFAULT_RECORD_BOARDS = 5

/** The routed record table of a page: a single-record data source read at a route parameter. */
const recordSourceOf = (
  page: Page
): { readonly table: string; readonly param: string } | undefined => {
  const source = (page as { readonly dataSource?: unknown }).dataSource as
    { readonly table?: unknown; readonly mode?: unknown; readonly param?: unknown } | undefined
  return source?.mode === 'single' &&
    typeof source.table === 'string' &&
    typeof source.param === 'string'
    ? { table: source.table, param: source.param }
    : undefined
}

/**
 * How a routed page names the record it draws: the route parameter, the table
 * and the field the parameter is matched against — the id for a single-record
 * data source, the slug field for a `collection` page (whose parameter is
 * named after that field), and the rows its `collection.filter` keeps.
 */
interface RecordRoute {
  readonly table: string
  readonly param: string
  readonly key: string
  readonly filter?: readonly Readonly<Record<string, unknown>>[] | undefined
}

export const recordRouteOf = (page: Page): RecordRoute | undefined => {
  const source = recordSourceOf(page)
  if (source !== undefined) return { ...source, key: 'id' }
  const collection = (page as { readonly collection?: unknown }).collection as
    | { readonly table?: unknown; readonly slugField?: unknown; readonly filter?: unknown }
    | undefined
  return typeof collection?.table === 'string' && typeof collection.slugField === 'string'
    ? {
        table: collection.table,
        param: collection.slugField,
        key: collection.slugField,
        filter: Array.isArray(collection.filter) ? collection.filter : [],
      }
    : undefined
}

/** One address a routed page is drawn at: its route value, and the seeded row it draws. */
interface RecordAddress {
  readonly value: string
  readonly row: PageSeedRow | undefined
}

/** The seeded rows a routed page may be drawn at, in seed order: a slug page's kept by its filter. */
const seededRecordsOf = (route: RecordRoute, seed: PageDrawOptions['seed']) => {
  const rows = seed?.tables[route.table] ?? []
  return route.filter === undefined
    ? rows
    : queriedSeededRows(cappedSeedRows(rows), {
        filter: route.filter.map((condition) => ({
          field: String(condition['field']),
          operator: String(condition['operator']),
          value: condition['value'],
        })),
      })
}

/**
 * The addresses a routed page is drawn at, at most `--records`: its seeded
 * records, by the field its route names them by, or a content folder's files
 * by their slugs; none for any other page.
 */
export const recordAddressesOf = (
  page: Page,
  options: PageDrawOptions,
  contentSlugs: readonly string[] | undefined
): {
  readonly param: string
  readonly table: string
  readonly records: readonly RecordAddress[]
} => {
  const limit = options.records ?? DEFAULT_RECORD_BOARDS
  if (contentSlugs !== undefined) {
    const param = /:([A-Za-z_]\w*)/.exec(primaryPagePath(page.path))?.[1] ?? 'slug'
    return {
      param,
      table: '',
      records: contentSlugs.slice(0, 1).map((value) => ({ value, row: undefined })),
    }
  }
  const route = recordRouteOf(page)
  if (route === undefined) return { param: '', table: '', records: [] }
  return {
    param: route.param,
    table: route.table,
    records: seededRecordsOf(route, options.seed)
      .slice(0, limit)
      .map((row) => ({ value: String(row[route.key] ?? ''), row })),
  }
}

/**
 * Why a routed page has nothing to be drawn at, or `undefined` when it has an
 * address: under `--seed`, a slug page none of whose seeded records its filter
 * keeps; a content-folder page whose folder holds no file it includes.
 */
export const unaddressedPageNoticeOf = (
  page: Page,
  options: PageDrawOptions,
  contentSlugs: readonly string[] | undefined
): string | undefined => {
  if (contentSlugs !== undefined) {
    const { directory } =
      (page as { readonly contentDir?: { readonly directory?: unknown } }).contentDir ?? {}
    return contentSlugs.length > 0
      ? undefined
      : `Note: page ${page.name} is drawn from the content folder ${String(directory)}, which ` +
          'holds no file it includes, so it has nothing to be drawn at and is skipped.'
  }
  const route = recordRouteOf(page)
  if (route?.filter === undefined || options.seed === undefined) return undefined
  return seededRecordsOf(route, options.seed).length > 0
    ? undefined
    : `Note: page ${page.name} is routed by the ${route.key} of ${route.table}, and no seeded ` +
        'record its filter keeps has one, so it has nothing to be drawn at and is skipped.'
}
